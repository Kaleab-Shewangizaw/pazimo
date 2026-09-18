const mongoose = require("mongoose");
const { DEFAULT_COMMISSION_RATE } = require("../config/rates");

// The cinema channel's TICKET revenue reader — the cinema twin of
// ticketRevenueQuery.js.
//
// The arithmetic is identical to the event side: Pazimo's commission, the 15%
// government VAT charged ON that commission (not on the ticket price), and the
// seller's own VAT withheld only where Pazimo covers them. What differs is which
// ledger is read (CinemaTicket, never Ticket), how it is scoped (by `cinema`
// directly, with no event-id round trip), and which field holds the withheld VAT
// rate (`cinemaVatRate`, from Cinema.coversCinemaVat).
//
// Two ledgers so cinema money can never be summed into an organizer's balance by
// an aggregation that forgot to filter, but one definition of what a 3% cut
// means — the same rule the concession channels follow.

// Statuses that take a cinema ticket out of revenue. "cancelled" and "refunded"
// rows stay in the ledger deliberately (history, not erasure) so they must be
// excluded here rather than deleted at source.
const EXCLUDED_TICKET_STATUS = ["cancelled", "refunded", "expired"];
const EXCLUDED_PAYMENT_STATUS = ["failed"];

/**
 * Match stage for cinema tickets that count as revenue, in one currency.
 *
 * Unpaid rows are excluded: a box-office ticket is written already completed,
 * and an online one only becomes revenue when its payment settles. Counting
 * `pending` would report money that may never arrive — the failure mode the
 * event side avoids through validTicketMatch.
 */
const validCinemaTicketMatch = (currency = "ETB") => ({
  totalAmount: { $gt: 0 },
  currency,
  status: { $nin: EXCLUDED_TICKET_STATUS },
  paymentStatus: { $nin: EXCLUDED_PAYMENT_STATUS.concat("pending") },
});

// Tickets sold before per-cinema rates existed carry no snapshot and fall back
// to the default that was in force.
const COMMISSION_RATE_EXPR = {
  $ifNull: ["$commissionRate", DEFAULT_COMMISSION_RATE],
};

// Withheld only where Pazimo covers the cinema; missing means 0, so sales made
// before coverage existed are untouched.
const CINEMA_VAT_RATE_EXPR = { $ifNull: ["$cinemaVatRate", 0] };

// The government VAT-on-commission rate this ticket was actually sold under,
// snapshotted per row exactly like COMMISSION_RATE_EXPR — not the live
// config/rates.js VAT_RATE. See ticketRevenueQuery.js's revenueExprs for the
// full reasoning: falls back to 0, never to "whatever VAT_RATE is right now."
const VAT_RATE_EXPR = { $ifNull: ["$vatRate", 0] };

const COMMISSION_EXPR = { $multiply: ["$totalAmount", COMMISSION_RATE_EXPR] };

// VAT is 15% OF the commission, not of the ticket price — a 3% cut costs the
// cinema 3.45%.
const VAT_EXPR = {
  $multiply: ["$totalAmount", COMMISSION_RATE_EXPR, VAT_RATE_EXPR],
};

// The cinema's own VAT, charged on the ticket price. A liability Pazimo remits
// on their behalf, never Pazimo revenue — no "Pazimo earned" figure includes it.
const CINEMA_VAT_EXPR = {
  $multiply: ["$totalAmount", CINEMA_VAT_RATE_EXPR],
};

const CINEMA_SHARE_EXPR = {
  $subtract: [
    "$totalAmount",
    {
      $add: [
        { $multiply: ["$totalAmount", COMMISSION_RATE_EXPR, { $add: [1, VAT_RATE_EXPR] }] },
        CINEMA_VAT_EXPR,
      ],
    },
  ],
};

/**
 * Accumulators for any $group over cinema tickets.
 *
 * The seller-facing keys are named for the cinema — `cinemaVat` and
 * `cinemaRevenue`, not `organizerVat` and `organizerRevenue`. A cinema's money
 * must never be readable through a field called "organizer": that is precisely
 * the confusion this channel split exists to prevent, and a mislabelled key is
 * how it would creep back in.
 *
 * grossRevenue = pazimoCommission + vatOnCommission + cinemaVat + cinemaRevenue,
 * always.
 */
const cinemaTicketRevenueAccumulators = () => ({
  grossRevenue: { $sum: "$totalAmount" },
  pazimoCommission: { $sum: COMMISSION_EXPR },
  vatOnCommission: { $sum: VAT_EXPR },
  cinemaVat: { $sum: CINEMA_VAT_EXPR },
  cinemaRevenue: { $sum: CINEMA_SHARE_EXPR },
  seatsSold: { $sum: "$quantity" },
});

const EMPTY_TOTALS = {
  grossRevenue: 0,
  pazimoCommission: 0,
  vatOnCommission: 0,
  cinemaVat: 0,
  cinemaRevenue: 0,
  seatsSold: 0,
  ticketCount: 0,
};

/**
 * One cinema's ticket totals.
 *
 * The id is cast here for the reason getOrganizerBeverageRevenue documents:
 * aggregation $match does no schema casting, so the string id every caller holds
 * (req.user.userId, req.params.cinemaId) would silently match nothing — and a
 * balance that silently reads 0.00 is the worst possible failure mode for a
 * payout.
 */
const getCinemaTicketRevenue = async (cinemaId, currency = "ETB") => {
  // Required lazily so this file stays importable from models without closing a
  // cycle through the model registry.
  const CinemaTicket = require("../models/CinemaTicket");

  if (!cinemaId || !mongoose.Types.ObjectId.isValid(String(cinemaId))) {
    return { ...EMPTY_TOTALS };
  }

  const cinema =
    cinemaId instanceof mongoose.Types.ObjectId
      ? cinemaId
      : new mongoose.Types.ObjectId(String(cinemaId));

  const [row] = await CinemaTicket.aggregate([
    { $match: { cinema, ...validCinemaTicketMatch(currency) } },
    {
      $group: {
        _id: null,
        ticketCount: { $sum: 1 },
        ...cinemaTicketRevenueAccumulators(),
      },
    },
  ]);

  return {
    grossRevenue: row?.grossRevenue || 0,
    pazimoCommission: row?.pazimoCommission || 0,
    vatOnCommission: row?.vatOnCommission || 0,
    cinemaVat: row?.cinemaVat || 0,
    cinemaRevenue: row?.cinemaRevenue || 0,
    seatsSold: row?.seatsSold || 0,
    ticketCount: row?.ticketCount || 0,
  };
};

module.exports = {
  EXCLUDED_TICKET_STATUS,
  EXCLUDED_PAYMENT_STATUS,
  validCinemaTicketMatch,
  COMMISSION_RATE_EXPR,
  COMMISSION_EXPR,
  VAT_EXPR,
  VAT_RATE_EXPR,
  CINEMA_VAT_RATE_EXPR,
  CINEMA_VAT_EXPR,
  CINEMA_SHARE_EXPR,
  cinemaTicketRevenueAccumulators,
  getCinemaTicketRevenue,
  EMPTY_CINEMA_TICKET_TOTALS: EMPTY_TOTALS,
};
