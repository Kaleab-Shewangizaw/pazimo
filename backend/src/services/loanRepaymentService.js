const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanRepayment");
const Notification = require("../models/Notification");
const OrganizerCapitalProfile = require("../models/OrganizerCapitalProfile");
const {
  DEBT_CUT_RATE,
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN,
  round2,
} = require("../config/rates");

// Fire a repayment-progress notification once per this many post-approval
// ticket sales.
const MILESTONE_TICKETS = 10;

const EPSILON = 0.01;

// Same "what counts as real revenue" filter used by financeService /
// capitalService, so the repayment math never drifts from the balance figures
// shown elsewhere.
const validTicketMatch = (currency) => ({
  ...(currency === "USD"
    ? { currency: "USD" }
    : { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }),
  price: { $gt: 0 },
  status: { $nin: ["cancelled", "failed", "expired"] },
  $or: [
    { paymentStatus: { $exists: false } },
    { paymentStatus: { $nin: ["cancelled", "failed"] } },
  ],
});

// Gross ticket revenue (sum of price) and sale count for an organizer's events,
// counting only tickets created at/after `since`. Loans credit the organizer at
// approval time, so `since` is the loan's disbursement/approval timestamp — only
// sales made after the money landed contribute to repaying it.
const getGrossRevenueSince = async (organizerId, since, currency) => {
  const match = {
    "eventData.organizer": new mongoose.Types.ObjectId(organizerId),
    ...validTicketMatch(currency),
  };
  if (since) match.createdAt = { $gte: new Date(since) };

  const rows = await Ticket.aggregate([
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "eventData",
      },
    },
    { $unwind: "$eventData" },
    { $match: match },
    { $group: { _id: null, revenue: { $sum: "$price" }, count: { $sum: 1 } } },
  ]);

  return { revenue: rows[0]?.revenue || 0, count: rows[0]?.count || 0 };
};

const loanRepaymentStart = (loan) =>
  loan.disbursedAt || loan.reviewedAt || loan.createdAt;

// Live repayment progress for a single loan, derived fresh from ticket sales —
// never read a stored counter when the result gates money. 60% of the gross
// ticket revenue made since the loan was credited goes toward the total
// repayable (principal + fee), capped at that total.
//
// The already-journaled total acts as a floor. Repayment is derived from live
// revenue, so a refund or cancellation after the fact shrinks that revenue and
// would otherwise walk the repaid figure *backwards* — silently handing the
// organizer back money that was already credited against their debt (and, for
// a loan that had flipped to "repaid", never getting re-collected because sync
// only visits active loans). Credits are journaled and monotonic; a shrinking
// revenue base stalls further repayment rather than reversing past ones.
const computeLoanProgress = async (loan) => {
  const totalRepayable = loan.totalRepayable || loan.approvedAmount || 0;
  const { revenue, count } = await getGrossRevenueSince(
    loan.organizer,
    loanRepaymentStart(loan),
    loan.currency
  );

  const derived = round2(DEBT_CUT_RATE * revenue);
  const journaled = round2(loan.totalRepaid || 0);
  const repaid = Math.min(totalRepayable, Math.max(derived, journaled));
  const outstanding = round2(Math.max(0, totalRepayable - repaid));

  return {
    revenue,
    ticketCount: count,
    totalRepayable,
    repaid,
    outstanding,
    // How much of `repaid` has not yet been written to the LoanRepayment
    // ledger. syncOrganizerLoans journals this and clears it.
    unjournaled: round2(Math.max(0, repaid - journaled)),
  };
};

const notifyOrganizer = async (req, loan, message) => {
  try {
    await Notification.create({
      userId: loan.organizer,
      type: "loan_status_change",
      message,
      loanId: loan._id,
      status: loan.status,
      amount: loan.approvedAmount || loan.requestedAmount,
    });
    const io = req?.app?.get?.("io");
    if (io) {
      io.to(`organizer_${loan.organizer}`).emit("loanStatusUpdated", {
        loanId: loan._id,
        status: loan.status,
        amount: loan.approvedAmount || loan.requestedAmount,
        currency: loan.currency,
      });
    }
  } catch (error) {
    console.error("Error sending loan repayment notification:", error);
  }
};

// Recompute every active loan for an organizer from live ticket sales: persist
// the derived outstanding/repaid figures, flip a fully-covered loan to "repaid"
// (which unblocks new requests), and fire progress notifications every
// MILESTONE_TICKETS post-approval sales. Idempotent — safe to call on any read
// path. `req` is optional and only used to emit socket events.
const syncOrganizerLoans = async (organizerId, req) => {
  const activeLoans = await Loan.find({
    organizer: organizerId,
    status: "active",
  });

  for (const loan of activeLoans) {
    const progress = await computeLoanProgress(loan);

    const milestone = Math.floor(progress.ticketCount / MILESTONE_TICKETS);
    const milestoneReached =
      milestone > (loan.repaymentMilestone || 0) && progress.outstanding > 0;

    const nowRepaid = progress.outstanding <= EPSILON;

    const changed =
      round2(loan.totalRepaid || 0) !== progress.repaid ||
      round2(loan.outstandingBalance || 0) !== progress.outstanding ||
      milestoneReached ||
      nowRepaid;

    if (!changed) continue;

    loan.totalRepaid = progress.repaid;
    loan.outstandingBalance = nowRepaid ? 0 : progress.outstanding;

    // Journal the increment before persisting it on the loan, so a crash
    // between the two leaves an unjournaled credit (re-written next sync)
    // rather than a credit that silently never made it into the ledger.
    if (progress.unjournaled > 0) {
      await LoanRepayment.create({
        loan: loan._id,
        organizer: loan.organizer,
        source: "ticket_sales",
        amount: progress.unjournaled,
        currency: loan.currency,
        outstandingBalanceAfter: nowRepaid ? 0 : progress.outstanding,
        ticketRevenueBasis: round2(progress.revenue),
        totalRepaidAfter: progress.repaid,
        note: `Automatic ${Math.round(
          DEBT_CUT_RATE * 100
        )}% cut of ticket sales`,
      });
    }

    if (milestoneReached) {
      loan.repaymentMilestone = milestone;
    }

    if (nowRepaid) {
      loan.status = "repaid";
      loan.blocksNewRequests = false;
      await OrganizerCapitalProfile.updateOne(
        { organizer: loan.organizer },
        { hasActiveLoan: false },
        { upsert: true }
      );
    }

    await loan.save();

    if (nowRepaid) {
      await notifyOrganizer(
        req,
        loan,
        `Your Pazimo Capital advance has been fully repaid from your ticket sales. You can request a new advance.`
      );
    } else if (milestoneReached) {
      await notifyOrganizer(
        req,
        loan,
        `${milestone * MILESTONE_TICKETS} ticket sales in — ${Math.round(
          DEBT_CUT_RATE * 100
        )}% of their value has gone toward your Pazimo Capital advance. Remaining balance: ${progress.outstanding.toFixed(
          2
        )} ${loan.currency}.`
      );
    }
  }
};

// Aggregate loan position for an organizer used by the balance calculation:
// how much borrowed principal was credited, how much has been repaid out of
// ticket sales (which reduces the withdrawable balance), and the still-owed
// debt. Covers active + repaid loans in the given currency (both credited
// principal); loans are sequential (one active at a time) so their repayment
// windows never overlap and the per-loan figures simply sum.
const getOrganizerLoanFinance = async (organizerId, currency = "ETB") => {
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
  const loans = await Loan.find({
    organizer: organizerId,
    currency: normalizedCurrency,
    status: { $in: ["active", "repaid"] },
  });

  let principalCredited = 0;
  let totalRepaidFromTickets = 0;
  let outstandingDebt = 0;
  let activeLoan = null;

  for (const loan of loans) {
    principalCredited += loan.approvedAmount || 0;
    const progress = await computeLoanProgress(loan);
    totalRepaidFromTickets += progress.repaid;
    if (loan.status === "active") {
      outstandingDebt += progress.outstanding;
      activeLoan = {
        _id: loan._id,
        approvedAmount: loan.approvedAmount,
        feeRate: loan.feeRate,
        feeAmount: loan.feeAmount,
        totalRepayable: loan.totalRepayable,
        totalRepaid: progress.repaid,
        outstandingBalance: progress.outstanding,
        currency: loan.currency,
      };
    }
  }

  return {
    currency: normalizedCurrency,
    principalCredited: round2(principalCredited),
    totalRepaidFromTickets: round2(totalRepaidFromTickets),
    outstandingDebt: round2(outstandingDebt),
    activeLoan,
  };
};

// Platform-wide Pazimo Capital position for the admin dashboard: how much has
// been lent out, how much has come back through the automatic ticket-sales
// cut, and what is still at risk. Read straight off Loan — the per-loan
// figures there are kept current by syncOrganizerLoans and are monotonic, so
// this needs no per-organizer recomputation and stays cheap enough for a
// dashboard card.
const getPlatformCapitalPosition = async (currency = "ETB") => {
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";

  const [rows] = await Loan.aggregate([
    { $match: { currency: normalizedCurrency } },
    {
      $group: {
        _id: null,
        // Money actually handed out (active + repaid loans only — pending,
        // rejected and cancelled requests never moved any).
        totalDisbursed: {
          $sum: {
            $cond: [
              { $in: ["$status", ["active", "repaid"]] },
              { $ifNull: ["$approvedAmount", 0] },
              0,
            ],
          },
        },
        totalRepayable: {
          $sum: {
            $cond: [
              { $in: ["$status", ["active", "repaid"]] },
              { $ifNull: ["$totalRepayable", 0] },
              0,
            ],
          },
        },
        totalRecovered: {
          $sum: {
            $cond: [
              { $in: ["$status", ["active", "repaid"]] },
              { $ifNull: ["$totalRepaid", 0] },
              0,
            ],
          },
        },
        totalOutstanding: {
          $sum: {
            $cond: [
              { $eq: ["$status", "active"] },
              { $ifNull: ["$outstandingBalance", 0] },
              0,
            ],
          },
        },
        activeLoans: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
        repaidLoans: {
          $sum: { $cond: [{ $eq: ["$status", "repaid"] }, 1, 0] },
        },
        pendingLoans: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        pendingAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "pending"] },
              { $ifNull: ["$requestedAmount", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const totalDisbursed = round2(rows?.totalDisbursed || 0);
  const totalRepayable = round2(rows?.totalRepayable || 0);
  const totalRecovered = round2(rows?.totalRecovered || 0);

  return {
    currency: normalizedCurrency,
    totalDisbursed,
    totalRepayable,
    totalRecovered,
    totalOutstanding: round2(rows?.totalOutstanding || 0),
    // Fee income booked on loans handed out, and the share of it collected so
    // far. Fee is only truly earned once the whole advance is repaid, so this
    // is expected income, not realised.
    expectedFeeIncome: round2(totalRepayable - totalDisbursed),
    recoveryRate:
      totalRepayable > 0 ? round2((totalRecovered / totalRepayable) * 100) : 0,
    activeLoans: rows?.activeLoans || 0,
    repaidLoans: rows?.repaidLoans || 0,
    pendingLoans: rows?.pendingLoans || 0,
    pendingAmount: round2(rows?.pendingAmount || 0),
  };
};

module.exports = {
  DEBT_CUT_RATE,
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN,
  MILESTONE_TICKETS,
  getGrossRevenueSince,
  computeLoanProgress,
  syncOrganizerLoans,
  getOrganizerLoanFinance,
  getPlatformCapitalPosition,
};
