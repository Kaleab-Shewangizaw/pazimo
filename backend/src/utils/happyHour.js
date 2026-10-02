// A happy-hour CAMPAIGN's (models/HappyHour.js) state is derived from
// wall-clock time alone, never stored — the same philosophy
// utils/ticketAvailability.js uses for wave transitions: a document holds
// only what was actually decided (which drinks, at what price, a duration,
// when it should start), and "is it running right now" is answered fresh on
// every read rather than kept in sync by a scheduled job.
//
// This is what makes "start automatically at a scheduled time" need no cron:
// nothing has to run AT that moment. The very next read after it — a price
// lookup, a browse listing — compares `now` against `scheduledStartAt` and
// answers "active" on its own.

//
// The one piece of state that IS counted rather than derived is how many
// units each drink has sold at its discounted price (items[].sold), because
// a campaign can also be capped by quantity — "100 beers for 10 minutes",
// whichever runs out first. That counter is only ever moved by the atomic
// claimHappyHourUnits/releaseHappyHourUnits below.

const HappyHour = require("../models/HappyHour");

const MINUTE_MS = 60 * 1000;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Discounted units still available on one campaign item — null when the item has no cap. */
const itemRemaining = (item) =>
  item?.quantityLimit == null ? null : Math.max(item.quantityLimit - (item.sold || 0), 0);

const isItemSoldOut = (item) => itemRemaining(item) === 0;

/**
 * One HappyHour campaign's effective state right now — independent of which
 * drink is being asked about, since the whole campaign starts/ends together.
 *
 * `status`:
 *   "cancelled" — cancelledAt is set; permanent, regardless of timing
 *   "scheduled" — hasn't started yet (manual: waiting on "Start now";
 *                 scheduled: scheduledStartAt hasn't arrived)
 *   "active"    — a customer buying right now pays the campaign's price
 *   "ended"     — the window has closed
 *
 * `startsAt: null` on a "scheduled" manual campaign is the signal that it is
 * waiting on the "Start now" action, not counting down to a known time.
 */
const getCampaignState = (happyHour, now = new Date()) => {
  if (!happyHour) return { status: "none" };
  if (happyHour.cancelledAt) return { status: "cancelled" };

  const effectiveStart =
    happyHour.startMode === "manual" ? happyHour.startedAt : happyHour.scheduledStartAt;

  if (!effectiveStart) {
    return { status: "scheduled", startsAt: null };
  }

  const startsAt = new Date(effectiveStart);
  if (now < startsAt) {
    return { status: "scheduled", startsAt };
  }

  const endsAt = new Date(startsAt.getTime() + happyHour.durationMinutes * MINUTE_MS);

  // Every drink in it hit its quantity cap — the campaign is over even
  // though its timer isn't. (A drink with no cap never sells out here; its
  // discount is bounded only by the timer and its own stock.)
  const items = happyHour.items || [];
  if (items.length > 0 && items.every(isItemSoldOut)) {
    const soldOutTimes = items
      .map((i) => (i.soldOutAt ? new Date(i.soldOutAt).getTime() : null))
      .filter((t) => t != null);
    const soldOutAt = soldOutTimes.length ? new Date(Math.max(...soldOutTimes)) : null;
    return {
      status: "ended",
      endedAt: soldOutAt && soldOutAt < endsAt ? soldOutAt : endsAt,
      reason: "sold_out",
    };
  }

  if (now < endsAt) {
    return { status: "active", startsAt, endsAt };
  }

  return { status: "ended", endedAt: endsAt, reason: "time" };
};

/**
 * What one lineup row (an EventBeverage or VenueBeverage id) is affected by,
 * across every campaign that currently touches it.
 *
 * `happyHours` should already be scoped to the row's event/venue (a single
 * batch query per checkout/listing, not one per row — see the call sites in
 * concessionBasketService.js and beverageController.js/venueController.js).
 * Only "active" or "scheduled" campaigns are surfaced: an "ended" or
 * "cancelled" one no longer affects what a row costs or shows.
 *
 * A row is expected to belong to at most one live campaign at a time — the
 * create-time overlap guard in beverageController/venueController enforces
 * that — but if two ever did match, the first ACTIVE one wins over a merely
 * scheduled one, since that is the one actually charging money right now.
 */
const resolveLineupHappyHour = (happyHours, lineupId, now = new Date()) => {
  let scheduled = null;
  for (const happyHour of happyHours || []) {
    const item = happyHour.items?.find((i) => String(i.lineup) === String(lineupId));
    if (!item) continue;

    // This drink's own cap ran out — it's back at its regular price even if
    // the rest of the campaign is still running.
    if (isItemSoldOut(item)) continue;

    const state = getCampaignState(happyHour, now);
    const itemInfo = {
      price: item.price,
      happyHourId: happyHour._id,
      quantityLimit: item.quantityLimit ?? null,
      remaining: itemRemaining(item),
    };
    if (state.status === "active") {
      return { ...state, ...itemInfo };
    }
    if (state.status === "scheduled" && !scheduled) {
      scheduled = { ...state, ...itemInfo };
    }
  }
  return scheduled || { status: "none" };
};

/** The price a customer actually pays right now for one row — the campaign's
 * price while active, otherwise the row's regular price. */
const resolveEffectivePrice = (happyHours, lineupId, regularPrice, now = new Date()) => {
  const state = resolveLineupHappyHour(happyHours, lineupId, now);
  return state.status === "active" ? state.price : regularPrice;
};

/**
 * Price `quantity` units of one row from a snapshot, without claiming
 * anything — for quotes (checkout pricing) shown before money moves. When
 * fewer discounted units are left than asked for, the rest are priced at the
 * regular price; `unitPrice` is then the blended per-unit figure.
 */
const quoteLineTotal = (happyHours, lineupId, regularPrice, quantity, now = new Date()) => {
  const state = resolveLineupHappyHour(happyHours, lineupId, now);
  const discounted =
    state.status !== "active"
      ? 0
      : state.remaining == null
      ? quantity
      : Math.min(quantity, state.remaining);
  const discountedTotal = discounted ? discounted * state.price : 0;
  const totalAmount = round2(discountedTotal + (quantity - discounted) * regularPrice);
  return {
    unitPrice: round2(totalAmount / quantity),
    totalAmount,
    discountedQuantity: discounted,
  };
};

const CLAIM_ATTEMPTS = 4;

/**
 * Atomically take up to `quantity` discounted units of one row from whichever
 * campaign is active on it right now, and price the sale accordingly — the
 * happy-hour price for the units claimed, the regular price for the rest.
 *
 * The claim is a conditional update on the item's own `sold` counter (same
 * pattern the stock reservation uses), so concurrent buyers can never take
 * more discounted units than the cap allows; on contention it re-reads and
 * retries rather than giving up the discount outright.
 *
 * Returns `{ unitPrice, totalAmount, claim }`. `claim` is null when nothing
 * was claimed; otherwise pass it to releaseHappyHourUnits if the sale that
 * claimed it then fails to be written.
 */
const claimHappyHourUnits = async ({ happyHours, lineupId, regularPrice, quantity, now = new Date() }) => {
  const regular = () => ({
    unitPrice: regularPrice,
    totalAmount: round2(regularPrice * quantity),
    claim: null,
  });

  const initial = resolveLineupHappyHour(happyHours, lineupId, now);
  if (initial.status !== "active") return regular();

  const happyHourId = initial.happyHourId;
  let campaign = (happyHours || []).find((h) => String(h._id) === String(happyHourId));

  for (let attempt = 0; attempt < CLAIM_ATTEMPTS; attempt++) {
    if (attempt > 0) campaign = await HappyHour.findById(happyHourId).lean();
    if (!campaign) return regular();
    const state = getCampaignState(campaign, now);
    const item = campaign.items.find((i) => String(i.lineup) === String(lineupId));
    if (state.status !== "active" || !item) return regular();

    const limit = item.quantityLimit ?? null;
    const units = limit == null ? quantity : Math.min(quantity, itemRemaining(item));
    if (units <= 0) return regular();

    const itemMatch =
      limit == null
        ? { lineup: item.lineup }
        : { lineup: item.lineup, sold: { $lte: limit - units } };
    const updated = await HappyHour.findOneAndUpdate(
      { _id: happyHourId, cancelledAt: null, items: { $elemMatch: itemMatch } },
      { $inc: { "items.$.sold": units } },
      { new: true }
    ).lean();
    if (!updated) continue; // someone else claimed in between — re-read and retry

    const updatedItem = updated.items.find((i) => String(i.lineup) === String(lineupId));
    if (limit != null && (updatedItem?.sold || 0) >= limit) {
      await HappyHour.updateOne(
        { _id: happyHourId, "items.lineup": item.lineup },
        { $set: { "items.$.soldOutAt": now } }
      );
    }

    const totalAmount = round2(units * item.price + (quantity - units) * regularPrice);
    return {
      unitPrice: round2(totalAmount / quantity),
      totalAmount,
      claim: { happyHourId, lineupId: item.lineup, units },
    };
  }

  return regular();
};

/** Hand back discounted units claimed by claimHappyHourUnits for a sale that was never written. */
const releaseHappyHourUnits = async (claim) => {
  if (!claim || !claim.units) return;
  await HappyHour.updateOne(
    {
      _id: claim.happyHourId,
      items: { $elemMatch: { lineup: claim.lineupId, sold: { $gte: claim.units } } },
    },
    { $inc: { "items.$.sold": -claim.units }, $unset: { "items.$.soldOutAt": "" } }
  );
};

module.exports = {
  getCampaignState,
  resolveLineupHappyHour,
  resolveEffectivePrice,
  quoteLineTotal,
  claimHappyHourUnits,
  releaseHappyHourUnits,
};
