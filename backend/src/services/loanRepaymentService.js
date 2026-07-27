const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const Loan = require("../models/Loan");
const Notification = require("../models/Notification");
const OrganizerCapitalProfile = require("../models/OrganizerCapitalProfile");

// Share of each gross ticket sale routed to loan repayment while an organizer
// carries an outstanding Pazimo Capital debt. The remaining 40% stays with the
// organizer (Pazimo's 3% commission is taken out of that 40% side downstream in
// financeService). Repayment is fully automatic — there is no manual
// admin-recorded repayment anymore.
const DEBT_CUT_RATE = 0.6;

// Fire a repayment-progress notification once per this many post-approval
// ticket sales.
const MILESTONE_TICKETS = 10;

const EPSILON = 0.01;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

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
const computeLoanProgress = async (loan) => {
  const totalRepayable = loan.totalRepayable || loan.approvedAmount || 0;
  const { revenue, count } = await getGrossRevenueSince(
    loan.organizer,
    loanRepaymentStart(loan),
    loan.currency
  );

  const repaid = Math.min(totalRepayable, round2(DEBT_CUT_RATE * revenue));
  const outstanding = round2(Math.max(0, totalRepayable - repaid));

  return { revenue, ticketCount: count, totalRepayable, repaid, outstanding };
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

    if (milestoneReached) {
      loan.repaymentMilestone = milestone;
    }

    if (nowRepaid) {
      loan.status = "repaid";
      loan.blocksNewRequests = false;
      await OrganizerCapitalProfile.updateOne(
        { organizer: loan.organizer },
        { hasActiveLoan: false }
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
        `${milestone * MILESTONE_TICKETS} ticket sales in — 60% of their value has gone toward your Pazimo Capital advance. Remaining balance: ${progress.outstanding.toFixed(
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

module.exports = {
  DEBT_CUT_RATE,
  MILESTONE_TICKETS,
  getGrossRevenueSince,
  computeLoanProgress,
  syncOrganizerLoans,
  getOrganizerLoanFinance,
};
