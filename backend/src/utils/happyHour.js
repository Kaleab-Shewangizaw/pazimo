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

const MINUTE_MS = 60 * 1000;

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
  if (now < endsAt) {
    return { status: "active", startsAt, endsAt };
  }

  return { status: "ended", endedAt: endsAt };
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

    const state = getCampaignState(happyHour, now);
    if (state.status === "active") {
      return { ...state, price: item.price, happyHourId: happyHour._id };
    }
    if (state.status === "scheduled" && !scheduled) {
      scheduled = { ...state, price: item.price, happyHourId: happyHour._id };
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

module.exports = { getCampaignState, resolveLineupHappyHour, resolveEffectivePrice };
