const mongoose = require("mongoose");
const Withdrawal = require("../models/Withdrawal");
const {
  getCinemaTicketRevenue,
  EMPTY_CINEMA_TICKET_TOTALS,
} = require("../utils/cinemaTicketRevenueQuery");
const {
  getCinemaBeverageRevenue,
  EMPTY_CINEMA_BEVERAGE_TOTALS,
} = require("../utils/cinemaBeverageRevenueQuery");

// One cinema's money.
//
// A deliberate sibling of calculateOrganizerBalance and calculateVenueBalance
// rather than a branch inside either. calculateOrganizerBalance is built around
// events: it resolves the organizer's events, scans tickets by event id, and
// folds in Pazimo Capital, none of which a cinema has. Threading a "is this a
// cinema?" flag through all of it would leave every ticket and loan path one
// forgotten condition away from touching cinema money.
//
// It lives in its own file rather than alongside the venue function for the same
// reason the ledgers are separate collections: the strongest form of "cinema
// money cannot leak into event money" is that the code which computes it shares
// no call site with the code that computes theirs.
//
// A cinema has TWO pools — seats and concessions — settled independently, the
// way an organizer settles tickets and drinks independently. Selling out a
// screening does not let a cinema draw against popcorn it has not sold.
//
// Pazimo Capital does not reach either pool. Advances are underwritten against
// event ticket revenue; a cinema has none.

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

/**
 * Withdrawals already drawn against one cinema pool.
 *
 * Scoped by `cinema` AND by stream. Either alone would be enough today, but both
 * together mean a row can only be counted against this pool if it was explicitly
 * written as that kind of cinema payout for this cinema — so a future bug that
 * sets the wrong stream cannot quietly drain the other pool.
 */
const drawnAgainst = async (cinemaId, stream) => {
  const [row] = await Withdrawal.aggregate([
    {
      $match: {
        cinema: new mongoose.Types.ObjectId(String(cinemaId)),
        stream,
      },
    },
    {
      $group: {
        _id: null,
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
        },
        approved: {
          $sum: {
            $cond: [
              { $in: ["$status", ["approved", "completed"]] },
              "$amount",
              0,
            ],
          },
        },
      },
    },
  ]);

  return {
    pendingWithdrawals: round2(row?.pending || 0),
    approvedWithdrawals: round2(row?.approved || 0),
  };
};

/**
 * A cinema's balance, split into its two independent pools.
 *
 * `availableBalance` at the top level is the SUM of the two pools and exists for
 * display only. It must never be used to authorize a withdrawal: the withdrawal
 * endpoint validates against the specific pool named in the request, exactly as
 * the organizer side does, or ticket money would fund a concession payout.
 */
const calculateCinemaBalance = async (cinemaId, currency = "ETB") => {
  // Both cinema ledgers are ETB-only (each currency enum has one value), so a
  // USD request returns empty streams rather than running two pointless scans —
  // the same decision calculateOrganizerBalance makes for the beverage stream.
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
  const isEtb = normalizedCurrency === "ETB";

  const [ticketRevenue, beverageRevenue] = await Promise.all([
    isEtb
      ? getCinemaTicketRevenue(cinemaId, "ETB")
      : Promise.resolve({ ...EMPTY_CINEMA_TICKET_TOTALS }),
    isEtb
      ? getCinemaBeverageRevenue(cinemaId, "ETB")
      : Promise.resolve({ ...EMPTY_CINEMA_BEVERAGE_TOTALS }),
  ]);

  const [ticketDrawn, beverageDrawn] = await Promise.all([
    drawnAgainst(cinemaId, "cinema_tickets"),
    drawnAgainst(cinemaId, "cinema_beverages"),
  ]);

  const buildStream = (revenue, drawn, extra) => {
    const cinemaRevenue = round2(revenue.cinemaRevenue || 0);
    const cinemaVat = round2(revenue.cinemaVat || 0);
    return {
      availableBalance: round2(
        cinemaRevenue - drawn.pendingWithdrawals - drawn.approvedWithdrawals
      ),
      pendingWithdrawals: drawn.pendingWithdrawals,
      approvedWithdrawals: drawn.approvedWithdrawals,
      grossRevenue: round2(revenue.grossRevenue),
      cinemaRevenue,
      pazimoCommission: round2(revenue.pazimoCommission),
      vatOnCommission: round2(revenue.vatOnCommission),
      // Withheld for the government, never Pazimo revenue — reported on its own
      // for the same reason the event side reports organizerVat apart.
      cinemaVat,
      pazimoCollected: round2(
        revenue.pazimoCommission + revenue.vatOnCommission + cinemaVat
      ),
      ...extra,
    };
  };

  const tickets = buildStream(ticketRevenue, ticketDrawn, {
    seatsSold: ticketRevenue.seatsSold || 0,
    ticketCount: ticketRevenue.ticketCount || 0,
  });
  const beverages = buildStream(beverageRevenue, beverageDrawn, {
    unitsSold: beverageRevenue.unitsSold || 0,
    salesCount: beverageRevenue.salesCount || 0,
  });

  return {
    currency: normalizedCurrency,
    // Display only — see the note above. Withdrawals authorize per stream.
    availableBalance: round2(
      tickets.availableBalance + beverages.availableBalance
    ),
    pendingWithdrawals: round2(
      tickets.pendingWithdrawals + beverages.pendingWithdrawals
    ),
    approvedWithdrawals: round2(
      tickets.approvedWithdrawals + beverages.approvedWithdrawals
    ),
    streams: { tickets, beverages },
    combined: {
      grossRevenue: round2(tickets.grossRevenue + beverages.grossRevenue),
      cinemaRevenue: round2(tickets.cinemaRevenue + beverages.cinemaRevenue),
      pazimoCommission: round2(
        tickets.pazimoCommission + beverages.pazimoCommission
      ),
      vatOnCommission: round2(
        tickets.vatOnCommission + beverages.vatOnCommission
      ),
      cinemaVat: round2(tickets.cinemaVat + beverages.cinemaVat),
      pazimoCollected: round2(
        tickets.pazimoCollected + beverages.pazimoCollected
      ),
    },
  };
};

/**
 * The pool a withdrawal request names, and what may be drawn from it.
 *
 * Exposed so the withdrawal endpoint validates against ONE pool rather than the
 * combined figure — the rule the organizer side already follows for tickets vs
 * drinks, and the reason `stream` exists on Withdrawal at all.
 */
const CINEMA_WITHDRAWAL_STREAMS = {
  cinema_tickets: "tickets",
  cinema_beverages: "beverages",
};

const getCinemaPoolBalance = async (cinemaId, stream, currency = "ETB") => {
  const key = CINEMA_WITHDRAWAL_STREAMS[stream];
  if (!key) return null;
  const balance = await calculateCinemaBalance(cinemaId, currency);
  return balance.streams[key];
};

module.exports = {
  calculateCinemaBalance,
  getCinemaPoolBalance,
  CINEMA_WITHDRAWAL_STREAMS,
};
