const Event = require("../models/Event");
const { DEFAULT_COMMISSION_RATE } = require("../config/rates");

// One definition of "what counts as real ticket revenue", and one correct way to
// scope it to an organizer. financeService, loanRepaymentService and
// capitalService each carried their own copy of this; all three shared the same
// bug (see below) and could drift apart independently.

// "pending" means checkout started and payment was never confirmed
// (eventController.buyTicket sets status: "active" only once verified paid,
// "pending" otherwise). A real sale never sits there long — it either
// confirms or the stock-hold sweep (stockHoldExpiry.js) expires it within
// ~60-75s — but counting it as revenue let organizers withdraw against money
// that was never actually collected. Once the sweep later flipped the ticket
// to "expired" the revenue vanished retroactively, permanently, because the
// withdrawal had already gone out. Confirmed via a read-only production
// audit 2026-09-22: two organizers' negative balances matched (gross value
// of their stale pending tickets) x 0.97 exactly.
const EXCLUDED_TICKET_STATUS = ["cancelled", "failed", "expired", "pending"];
const EXCLUDED_PAYMENT_STATUS = ["cancelled", "failed"];

/**
 * Match stage for tickets that count as revenue, in one currency.
 *
 * The currency and payment-status conditions are combined under a single $and.
 * The old copies wrote two separate `$or` keys into the same object literal:
 *
 *   { ...(cur === "ETB" ? { $or: [currency…] } : { currency: cur }),
 *     status: {...},
 *     $or: [paymentStatus…] }          <-- silently replaces the first $or
 *
 * A JS object cannot hold two `$or` keys, so the later one won and the currency
 * filter vanished — every ETB query was quietly including USD tickets. USD was
 * unaffected because that branch sets `currency` directly rather than `$or`.
 */
const validTicketMatch = (currency) => {
  const conditions = [
    {
      $or: [
        { paymentStatus: { $exists: false } },
        { paymentStatus: { $nin: EXCLUDED_PAYMENT_STATUS } },
      ],
    },
  ];

  if (currency === "USD") {
    conditions.push({ currency: "USD" });
  } else if (currency === "ETB") {
    conditions.push({
      $or: [{ currency: "ETB" }, { currency: { $exists: false } }],
    });
  }
  // any other value (null/undefined) means "all currencies" — used by audits

  return {
    price: { $gt: 0 },
    status: { $nin: EXCLUDED_TICKET_STATUS },
    $and: conditions,
  };
};

/**
 * The organizer's events, and their ids.
 *
 * Scoping tickets to an organizer used to be done by $lookup-ing every ticket
 * into events, $unwinding, and only then filtering on eventData.organizer.
 * Mongo cannot use an index for a filter applied after a join, so that walked
 * the entire tickets collection and performed one event lookup per row — to
 * answer a question about a handful of tickets.
 *
 * Resolving event ids first uses the { organizer: 1 } index on Event, and the
 * resulting `event: { $in: [...] }` uses the ticket indexes that all start with
 * `event`. Same answer, bounded work.
 */
const getOrganizerEvents = (organizerId, projection = "_id") =>
  Event.find({ organizer: organizerId }).select(projection).lean();

const getOrganizerEventIds = async (organizerId) =>
  (await getOrganizerEvents(organizerId)).map((e) => e._id);

/** Ticket match scoped to one organizer, in one currency. */
const organizerTicketMatch = (eventIds, currency) => ({
  event: { $in: eventIds },
  ...validTicketMatch(currency),
});

// Tickets can represent several admissions; quantity lives in one of two legacy
// fields. Shared so every count agrees.
const TICKET_QUANTITY_EXPR = {
  $cond: [
    { $gt: ["$purchaseQuantity", 0] },
    "$purchaseQuantity",
    { $cond: [{ $gt: ["$ticketCount", 0] }, "$ticketCount", 1] },
  ],
};

/**
 * The per-ticket money split, as aggregation expressions.
 *
 * Commission is per event and snapshotted per ticket, so it cannot be a single
 * multiplication applied to a summed total. It has to be evaluated per ticket
 * at the rates that ticket was sold under, which is what these express.
 *
 * `f` builds a field reference, so the same definitions serve a pipeline
 * iterating the tickets collection (`$price`) and one working over tickets
 * already joined into an array (`$$t.price`). One definition, two shapes — the
 * alternative is a second copy that drifts.
 *
 * Missing snapshots are the normal case for old rows and must read as the
 * defaults that were actually in force: 3% commission, and no withheld VAT.
 * Reading a missing organizerVatRate as anything but 0 would retroactively
 * withhold 15% from revenue already reported and mostly paid out.
 */
const revenueExprs = (f) => {
  const price = f("price");
  const commissionRate = { $ifNull: [f("commissionRate"), DEFAULT_COMMISSION_RATE] };
  const organizerVatRate = { $ifNull: [f("organizerVatRate"), 0] };
  // The government VAT-ON-COMMISSION rate this ticket was actually sold
  // under, snapshotted per row exactly like commissionRate — NOT the live
  // config/rates.js VAT_RATE. Turning that constant on/off (or changing it)
  // must never restate revenue already counted and paid out, which is
  // exactly the mix-up this snapshot exists to prevent: fall back to 0, the
  // rate actually in force before this policy existed or on any row sold
  // before the constant changed, never to "whatever VAT_RATE is right now."
  const vatRate = { $ifNull: [f("vatRate"), 0] };

  // Pazimo's fee, and the government VAT on that fee — 15% OF the commission,
  // not of the ticket price.
  const commission = { $multiply: [price, commissionRate] };
  const vat = { $multiply: [price, commissionRate, vatRate] };

  // The organizer's own VAT that Pazimo withheld and owes the government.
  // Charged on the ticket price, unlike the VAT above. A liability, never
  // revenue — no "Pazimo earned" figure may include it.
  const organizerVat = { $multiply: [price, organizerVatRate] };

  return {
    price,
    commissionRate,
    organizerVatRate,
    vatRate,
    commission,
    vat,
    organizerVat,
    // What the organizer keeps: price less commission, VAT on it, and their own.
    organizerShare: {
      $subtract: [
        price,
        {
          $add: [
            { $multiply: [price, commissionRate, { $add: [1, vatRate] }] },
            organizerVat,
          ],
        },
      ],
    },
  };
};

const ROOT = revenueExprs((k) => `$${k}`);

const COMMISSION_RATE_EXPR = ROOT.commissionRate;
const ORGANIZER_VAT_RATE_EXPR = ROOT.organizerVatRate;
const VAT_RATE_EXPR = ROOT.vatRate;
const COMMISSION_EXPR = ROOT.commission;
const VAT_EXPR = ROOT.vat;
const ORGANIZER_VAT_EXPR = ROOT.organizerVat;
const ORGANIZER_SHARE_EXPR = ROOT.organizerShare;

/**
 * The figures every revenue screen needs, summed per ticket so a mix of
 * commission rates and VAT-coverage settings across events adds up correctly.
 * Drop into any $group.
 *
 * grossRevenue = pazimoCommission + vatOnCommission + organizerVat +
 * organizerRevenue, always.
 */
const revenueAccumulators = () => ({
  grossRevenue: { $sum: ROOT.price },
  pazimoCommission: { $sum: COMMISSION_EXPR },
  vatOnCommission: { $sum: VAT_EXPR },
  organizerVat: { $sum: ORGANIZER_VAT_EXPR },
  organizerRevenue: { $sum: ORGANIZER_SHARE_EXPR },
});

/**
 * The same five figures for a pipeline that has already joined tickets into an
 * array field — `$addFields` after a `$lookup`, where there is no `$group` to
 * accumulate over.
 *
 * Several dashboards were splitting such an array with a flat `price * 0.97`,
 * which stopped being true the moment any event moved off 3% and is wildly
 * wrong for an event whose VAT Pazimo covers. Summing per element fixes both.
 */
const revenueFieldsOverArray = (arrayPath) => {
  const e = revenueExprs((k) => `$$t.${k}`);
  const sum = (expr) => ({
    $sum: { $map: { input: arrayPath, as: "t", in: expr } },
  });
  return {
    grossRevenue: sum(e.price),
    pazimoCommission: sum(e.commission),
    vatOnCommission: sum(e.vat),
    organizerVat: sum(e.organizerVat),
    organizerRevenue: sum(e.organizerShare),
  };
};

module.exports = {
  COMMISSION_RATE_EXPR,
  COMMISSION_EXPR,
  VAT_EXPR,
  VAT_RATE_EXPR,
  ORGANIZER_VAT_RATE_EXPR,
  ORGANIZER_VAT_EXPR,
  ORGANIZER_SHARE_EXPR,
  revenueExprs,
  revenueAccumulators,
  revenueFieldsOverArray,
  EXCLUDED_TICKET_STATUS,
  EXCLUDED_PAYMENT_STATUS,
  validTicketMatch,
  getOrganizerEvents,
  getOrganizerEventIds,
  organizerTicketMatch,
  TICKET_QUANTITY_EXPR,
};
