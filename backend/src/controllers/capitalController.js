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
    const { page = 1, limit = 10, search, currency } = req.query;
    const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
    const skip = (page - 1) * limit;

    const query = { role: "organizer" };
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
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
        const [profile, metrics, activeLoan] = await Promise.all([
          getOrCreateProfile(organizer._id),
          calculateOrganizerCapitalMetrics(organizer._id, normalizedCurrency),
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

    const [profile, metrics, loans] = await Promise.all([
      getOrCreateProfile(id),
      calculateOrganizerCapitalMetrics(id, currency),
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

const listLoans = async (req, res) => {
  try {
    const { status, organizerId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status && status !== "all") query.status = status;
    if (organizerId) query.organizer = organizerId;

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
    const feeAmount = Math.round(requestedApprovedAmount * feeRate * 100) / 100;
    const totalRepayable = Math.round((requestedApprovedAmount + feeAmount) * 100) / 100;

    loan.approvedAmount = requestedApprovedAmount;
    loan.feeRate = feeRate;
    loan.feeAmount = feeAmount;
    loan.totalRepayable = totalRepayable;
    loan.outstandingBalance = totalRepayable;
    loan.status = "approved";
    loan.reviewedBy = req.user.userId;
    loan.reviewedAt = new Date();
    await loan.save();

    await notifyOrganizer(
      req,
      loan,
      `Your loan request has been approved for ${requestedApprovedAmount} ${loan.currency}. It will be disbursed shortly.`
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
      { hasActiveLoan: false }
    );

    await notifyOrganizer(req, loan, `Your loan request was rejected: ${reason}`);

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error rejecting loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const disburseLoan = async (req, res) => {
  try {
    const { reference } = req.body;
    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.status !== "approved") {
      throw new BadRequestError(`Cannot disburse a loan with status '${loan.status}'`);
    }

    loan.status = "active";
    loan.disbursedAt = new Date();
    loan.disbursementReference = reference;
    await loan.save();

    await OrganizerCapitalProfile.updateOne(
      { organizer: loan.organizer },
      { hasActiveLoan: true }
    );

    // No balance write happens here on purpose — financeService.calculateLoanBalance
    // derives the withdrawable loan balance live from Loan.status/approvedAmount,
    // same "compute fresh, never a stored counter" pattern as ticket revenue.
    // Flipping status to "active" is what makes it show up.
    await notifyOrganizer(
      req,
      loan,
      `Your loan of ${loan.approvedAmount} ${loan.currency} has been added to your withdrawal balance. Request a withdrawal to receive it.`
    );

    res.status(StatusCodes.OK).json({ success: true, data: loan });
  } catch (error) {
    console.error("Error disbursing loan:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const recordRepayment = async (req, res) => {
  try {
    const { note } = req.body;
    const requestedAmount = Number(req.body.amount);
    if (!(requestedAmount > 0)) throw new BadRequestError("amount must be greater than 0");

    const loan = await Loan.findById(req.params.id);
    if (!loan) throw new NotFoundError("Loan not found");
    if (loan.status !== "active") {
      throw new BadRequestError(`Cannot record a repayment against a loan with status '${loan.status}'`);
    }

    // Cap at the outstanding balance — an overshoot becomes ordinary
    // withdrawable revenue for the organizer, not credit toward a future loan.
    const appliedAmount = Math.min(requestedAmount, loan.outstandingBalance);
    const newOutstanding = Math.round((loan.outstandingBalance - appliedAmount) * 100) / 100;

    const repayment = await LoanRepayment.create({
      loan: loan._id,
      organizer: loan.organizer,
      amount: appliedAmount,
      currency: loan.currency,
      recordedBy: req.user.userId,
      outstandingBalanceAfter: newOutstanding,
      note,
    });

    loan.outstandingBalance = newOutstanding;
    loan.totalRepaid = Math.round((loan.totalRepaid + appliedAmount) * 100) / 100;
    if (newOutstanding <= EPSILON) {
      loan.outstandingBalance = 0;
      loan.status = "repaid";
      loan.blocksNewRequests = false;
      await OrganizerCapitalProfile.updateOne(
        { organizer: loan.organizer },
        { hasActiveLoan: false }
      );
    }
    await loan.save();

    await notifyOrganizer(
      req,
      loan,
      loan.status === "repaid"
        ? `Your loan has been fully repaid.`
        : `A repayment of ${appliedAmount} ${loan.currency} was recorded. Outstanding balance: ${newOutstanding} ${loan.currency}.`
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { loan, repayment, cappedFrom: requestedAmount !== appliedAmount ? requestedAmount : undefined },
    });
  } catch (error) {
    console.error("Error recording repayment:", error);
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
      { hasActiveLoan: false }
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

    const [metrics, activeLoan] = await Promise.all([
      calculateOrganizerCapitalMetrics(organizerId, currency),
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
    const metrics = await calculateOrganizerCapitalMetrics(organizerId, currency);

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
      { hasActiveLoan: true }
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
      { hasActiveLoan: false }
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
  listLoans,
  getLoan,
  approveLoan,
  rejectLoan,
  disburseLoan,
  recordRepayment,
  adminCancelLoan,
  getMyEligibility,
  getMySummary,
  createLoanRequest,
  listMyLoans,
  getMyLoan,
  cancelMyLoan,
};
