const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const User = require("../models/User");
const Loan = require("../models/Loan");
const LoanRepayment = require("../models/LoanRepayment");
const OrganizerCapitalProfile = require("../models/OrganizerCapitalProfile");
const Notification = require("../models/Notification");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} = require("../errors");
const {
  calculateOrganizerCapitalMetrics,
  getBlockingLoan,
} = require("../services/capitalService");
const {
  syncOrganizerLoans,
  DEBT_CUT_RATE,
} = require("../services/loanRepaymentService");

const EPSILON = 0.01;

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
    const io = req.app.get("io");
    if (io) {
      io.to(`organizer_${loan.organizer}`).emit("loanStatusUpdated", {
        loanId: loan._id,
        status: loan.status,
        amount: loan.approvedAmount || loan.requestedAmount,
        currency: loan.currency,
      });
    }
  } catch (error) {
    console.error("Error notifying organizer of loan status change:", error);
  }
};

const getOrCreateProfile = async (organizerId) => {
  let profile = await OrganizerCapitalProfile.findOne({ organizer: organizerId });
  if (!profile) {
    profile = await OrganizerCapitalProfile.create({ organizer: organizerId });
  }
  return profile;
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const listOrganizersForCapital = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, currency, eligibility } = req.query;
    const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
    const skip = (page - 1) * limit;

    const query = { role: "organizer" };
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
    }

    // "Eligible organizers" tab: restrict to organizers whose capital profile is
    // marked eligible. Only eligible organizers ever have such a profile, so an
    // $in on their ids is enough (organizers with no profile default to
    // not_eligible and are correctly excluded).
    if (eligibility === "eligible" || eligibility === "not_eligible") {
      const profiles = await OrganizerCapitalProfile.find({ eligibility }).select(
        "organizer"
      );
      query._id = { $in: profiles.map((p) => p.organizer) };
    }

    const [organizers, total] = await Promise.all([
      User.find(query)
        .select("firstName lastName email phoneNumber createdAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    const enriched = await Promise.all(
      organizers.map(async (organizer) => {
        // Bring any active advance up to date with ticket sales before reading.
        await syncOrganizerLoans(organizer._id, req);
        const profile = await getOrCreateProfile(organizer._id);
        const [metrics, activeLoan] = await Promise.all([
          calculateOrganizerCapitalMetrics(organizer._id, normalizedCurrency, { profile }),
          getBlockingLoan(organizer._id),
        ]);

        return {
          ...organizer,
          eligibility: profile.eligibility,
          metrics,
          activeLoan: activeLoan
            ? { _id: activeLoan._id, status: activeLoan.status, approvedAmount: activeLoan.approvedAmount, requestedAmount: activeLoan.requestedAmount, currency: activeLoan.currency }
            : null,
        };
      })
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: enriched,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing organizers for capital:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list organizers",
      error: error.message,
    });
  }
};

const getOrganizerCapitalDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    const organizer = await User.findOne({ _id: id, role: "organizer" }).select(
      "firstName lastName email phoneNumber createdAt"
    );
    if (!organizer) throw new NotFoundError("Organizer not found");

    await syncOrganizerLoans(id, req);

    const profile = await getOrCreateProfile(id);
    const [metrics, loans] = await Promise.all([
      calculateOrganizerCapitalMetrics(id, currency, { profile }),
      Loan.find({ organizer: id }).sort("-createdAt").populate("reviewedBy", "firstName lastName email"),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { organizer, profile, metrics, loans },
    });
  } catch (error) {
    console.error("Error getting organizer capital detail:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const setEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { eligibility, notes } = req.body;

    if (!["eligible", "not_eligible"].includes(eligibility)) {
      throw new BadRequestError("eligibility must be 'eligible' or 'not_eligible'");
    }

    const organizer = await User.findOne({ _id: id, role: "organizer" });
    if (!organizer) throw new NotFoundError("Organizer not found");

    const profile = await getOrCreateProfile(id);
    profile.eligibility = eligibility;
    profile.eligibilitySetBy = req.user.userId;
    profile.eligibilitySetAt = new Date();
    if (notes !== undefined) profile.eligibilityNotes = notes;
    await profile.save();

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error setting eligibility:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const setBorrowingLimitOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { borrowingLimitOverride, note } = req.body;

    const organizer = await User.findOne({ _id: id, role: "organizer" });
    if (!organizer) throw new NotFoundError("Organizer not found");

    const profile = await getOrCreateProfile(id);

    // null/undefined clears the override and falls back to the
    // auto-calculated 30%-of-average figure.
    if (borrowingLimitOverride === null || borrowingLimitOverride === undefined) {
      profile.borrowingLimitOverride = undefined;
    } else {
      const value = Number(borrowingLimitOverride);
      if (!(value >= 0)) {
        throw new BadRequestError("borrowingLimitOverride must be a non-negative number");
      }
      profile.borrowingLimitOverride = value;
    }
    profile.borrowingLimitOverrideSetBy = req.user.userId;
    profile.borrowingLimitOverrideSetAt = new Date();
    if (note !== undefined) profile.borrowingLimitOverrideNote = note;
    await profile.save();

    const metrics = await calculateOrganizerCapitalMetrics(id, req.body.currency, { profile });

    res.status(StatusCodes.OK).json({ success: true, data: { profile, metrics } });
  } catch (error) {
    console.error("Error setting borrowing limit override:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const listLoans = async (req, res) => {
  try {
    const { status, organizerId, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status && status !== "all") query.status = status;
    if (organizerId) query.organizer = organizerId;

    // Search matches the loan's own reference number, or the name/email of
    // the organizer it belongs to — the two things a support conversation
    // usually starts from.
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const matchingOrganizers = await User.find({
        role: "organizer",
        $or: [{ firstName: regex }, { lastName: regex }, { email: regex }],
      }).select("_id");
      query.$or = [
        { referenceNumber: regex },
        { organizer: { $in: matchingOrganizers.map((o) => o._id) } },
      ];
    }

    // Sync active advances (distinct organizers) to the latest ticket sales so
    // the list reflects current repayment progress and active→repaid transitions.
    const activeOrganizerIds = await Loan.find({ ...query, status: "active" })
      .distinct("organizer");
    for (const orgId of activeOrganizerIds) {
      await syncOrganizerLoans(orgId, req);
    }

    const [loans, total, statsRows] = await Promise.all([
      Loan.find(query)
        .populate("organizer", "firstName lastName email")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Loan.countDocuments(query),
      Loan.aggregate([
        { $match: query },
        { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$requestedAmount" } } },
      ]),
    ]);

    const stats = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      active: { count: 0, amount: 0 },
      repaid: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };
    statsRows.forEach((row) => {
      if (stats[row._id]) stats[row._id] = { count: row.count, amount: row.amount };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: loans,
      stats,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing loans:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list loans",
      error: error.message,
    });
  }
};

const getLoan = async (req, res) => {
  try {
    const existing = await Loan.findById(req.params.id).select("organizer");
    if (!existing) throw new NotFoundError("Loan not found");
    await syncOrganizerLoans(existing.organizer, req);

    const loan = await Loan.findById(req.params.id)
      .populate("organizer", "firstName lastName email phoneNumber")
      .populate("reviewedBy", "firstName lastName email");
    if (!loan) throw new NotFoundError("Loan not found");

    const repayments = await LoanRepayment.find({ loan: loan._id })
      .sort("-createdAt")
      .populate("recordedBy", "firstName lastName email");

    res.status(StatusCodes.OK).json({ success: true, data: { loan, repayments } });
  } catch (error) {
    console.error("Error getting loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const approveLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.status !== "pending") {
      throw new BadRequestError(`Cannot approve a loan with status '${loan.status}'`);
    }

    const requestedApprovedAmount = Number(req.body.approvedAmount ?? loan.requestedAmount);
    if (!(requestedApprovedAmount > 0)) {
      throw new BadRequestError("approvedAmount must be greater than 0");
    }

    // Re-check live revenue in case it dropped (refunds/disputes) since the
    // request was submitted — never approve against a stale snapshot alone.
    const liveMetrics = await calculateOrganizerCapitalMetrics(loan.organizer, loan.currency);
    if (requestedApprovedAmount > liveMetrics.borrowingLimit + EPSILON) {
      throw new BadRequestError(
        `Approved amount (${requestedApprovedAmount} ${loan.currency}) exceeds the organizer's current borrowing limit of ${liveMetrics.borrowingLimit} ${loan.currency}`
      );
    }

    const feeRate = req.body.feeRate !== undefined ? Number(req.body.feeRate) : loan.feeRate;
    if (!(feeRate >= 0)) {
      throw new BadRequestError("feeRate must be a non-negative number");
    }
    const feeAmount = Math.round(requestedApprovedAmount * feeRate * 100) / 100;
    const totalRepayable = Math.round((requestedApprovedAmount + feeAmount) * 100) / 100;

    const now = new Date();
    loan.approvedAmount = requestedApprovedAmount;
    loan.feeRate = feeRate;
    loan.feeAmount = feeAmount;
    loan.totalRepayable = totalRepayable;
    loan.outstandingBalance = totalRepayable;
    loan.totalRepaid = 0;
    loan.repaymentMilestone = 0;
    // Approval credits the money immediately — there's no separate manual
    // disburse step. Status goes straight to "active": the principal shows up
    // in the organizer's withdrawal balance and repayment starts accruing from
    // ticket sales made from this moment on (disbursedAt is the repayment
    // start; see loanRepaymentService).
    loan.status = "active";
    loan.reviewedBy = req.user.userId;
    loan.reviewedAt = now;
    loan.disbursedAt = now;
    await loan.save();

    await OrganizerCapitalProfile.updateOne(
      { organizer: loan.organizer },
      { hasActiveLoan: true },
      { upsert: true }
    );

    await notifyOrganizer(
      req,
      loan,
      `Your Pazimo Capital request for ${requestedApprovedAmount} ${loan.currency} is approved and added to your withdrawal balance. A ${(feeRate * 100).toFixed(0)}% fee applies (repay ${totalRepayable} ${loan.currency}), taken automatically as ${Math.round(DEBT_CUT_RATE * 100)}% of your ticket sales.`
    );

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error approving loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const rejectLoan = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) throw new BadRequestError("A rejection reason is required");

    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.status !== "pending") {
      throw new BadRequestError(`Cannot reject a loan with status '${loan.status}'`);
    }

    loan.status = "rejected";
    loan.blocksNewRequests = false;
    loan.rejectionReason = reason;
    loan.reviewedBy = req.user.userId;
    loan.reviewedAt = new Date();
    await loan.save();

    await OrganizerCapitalProfile.updateOne(
      { organizer: loan.organizer },
      { hasActiveLoan: false },
      { upsert: true }
    );

    await notifyOrganizer(req, loan, `Your loan request was rejected: ${reason}`);

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error rejecting loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const adminCancelLoan = async (req, res) => {
  try {
    const { reason } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (!["pending", "approved"].includes(loan.status)) {
      throw new BadRequestError(`Cannot cancel a loan with status '${loan.status}'`);
    }

    loan.status = "cancelled";
    loan.blocksNewRequests = false;
    loan.cancelledBy = req.user.userId;
    loan.cancelledByModel = "Admin";
    loan.cancelledAt = new Date();
    loan.cancellationReason = reason;
    await loan.save();

    await OrganizerCapitalProfile.updateOne(
      { organizer: loan.organizer },
      { hasActiveLoan: false },
      { upsert: true }
    );

    await notifyOrganizer(req, loan, `Your loan request has been cancelled by Pazimo.`);

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error cancelling loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Organizer
// ---------------------------------------------------------------------------

const getMyEligibility = async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.userId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { eligibility: profile.eligibility },
    });
  } catch (error) {
    console.error("Error getting eligibility:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get eligibility",
    });
  }
};

const getMySummary = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    await syncOrganizerLoans(organizerId, req);

    const [metrics, activeLoan] = await Promise.all([
      calculateOrganizerCapitalMetrics(organizerId, currency, { profile: req.capitalProfile }),
      getBlockingLoan(organizerId),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        eligibility: req.capitalProfile.eligibility,
        metrics,
        activeLoan,
      },
    });
  } catch (error) {
    console.error("Error getting capital summary:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get capital summary",
    });
  }
};

const createLoanRequest = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const requestedAmount = Number(req.body.amount);
    if (!(requestedAmount > 0)) {
      throw new BadRequestError("amount must be greater than 0");
    }

    const blocking = await getBlockingLoan(organizerId);
    if (blocking) {
      throw new BadRequestError(
        `You already have a loan request in progress (status: ${blocking.status}). Repay or resolve it before requesting another.`
      );
    }

    // v1 is ETB-only — tickets/withdrawals track ETB and USD separately and
    // blending them into one limit isn't well-defined yet (see spec §02).
    const currency = "ETB";
    const metrics = await calculateOrganizerCapitalMetrics(organizerId, currency, {
      profile: req.capitalProfile,
    });

    if (requestedAmount > metrics.borrowingLimit + EPSILON) {
      throw new BadRequestError(
        `Requested amount (${requestedAmount} ${currency}) exceeds your current borrowing limit of ${metrics.borrowingLimit} ${currency}`
      );
    }

    const loan = await Loan.create({
      organizer: organizerId,
      requestedAmount,
      currency,
      limitAtRequest: metrics.borrowingLimit,
      limitBasis: metrics.limitBasis,
    });

    await OrganizerCapitalProfile.updateOne(
      { organizer: organizerId },
      { hasActiveLoan: true },
      { upsert: true }
    );

    res.status(StatusCodes.CREATED).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error creating loan request:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const listMyLoans = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const query = { organizer: req.user.userId };

    await syncOrganizerLoans(req.user.userId, req);

    const [loans, total] = await Promise.all([
      Loan.find(query).sort("-createdAt").skip(skip).limit(Number(limit)),
      Loan.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: loans,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error listing my loans:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list loans",
    });
  }
};

const getMyLoan = async (req, res) => {
  try {
    await syncOrganizerLoans(req.user.userId, req);

    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.organizer.toString() !== req.user.userId) {
      throw new ForbiddenError("You do not have access to this loan");
    }

    const repayments = await LoanRepayment.find({ loan: loan._id }).sort("-createdAt");

    res.status(StatusCodes.OK).json({ success: true, data: { loan, repayments } });
  } catch (error) {
    console.error("Error getting my loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const cancelMyLoan = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.organizer.toString() !== req.user.userId) {
      throw new ForbiddenError("You do not have access to this loan");
    }
    if (loan.status !== "pending") {
      throw new BadRequestError(`Cannot cancel a loan with status '${loan.status}'`);
    }

    loan.status = "cancelled";
    loan.blocksNewRequests = false;
    loan.cancelledBy = req.user.userId;
    loan.cancelledByModel = "User";
    loan.cancelledAt = new Date();
    loan.cancellationReason = "Cancelled by organizer";
    await loan.save();

    await OrganizerCapitalProfile.updateOne(
      { organizer: loan.organizer },
      { hasActiveLoan: false },
      { upsert: true }
    );

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error cancelling my loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  listOrganizersForCapital,
  getOrganizerCapitalDetail,
  setEligibility,
  setBorrowingLimitOverride,
  listLoans,
  getLoan,
  approveLoan,
  rejectLoan,
  adminCancelLoan,
  getMyEligibility,
  getMySummary,
  createLoanRequest,
  listMyLoans,
  getMyLoan,
  cancelMyLoan,
};
