const Event = require("../models/Event");

// One definition of "what counts as real ticket revenue", and one correct way to
// scope it to an organizer. financeService, loanRepaymentService and
// capitalService each carried their own copy of this; all three shared the same
// bug (see below) and could drift apart independently.

const EXCLUDED_TICKET_STATUS = ["cancelled", "failed", "expired"];
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

module.exports = {
  EXCLUDED_TICKET_STATUS,
  EXCLUDED_PAYMENT_STATUS,
  validTicketMatch,
  getOrganizerEvents,
  getOrganizerEventIds,
  organizerTicketMatch,
  TICKET_QUANTITY_EXPR,
};
