const Withdrawal = require("../models/Withdrawal");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const Notification = require("../models/Notification");
const { calculateOrganizerBalance } = require("../services/financeService");

// Get organizer's available balance
const getOrganizerBalance = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    const balanceData = await calculateOrganizerBalance(organizerId, currency);

    res.status(StatusCodes.OK).json({
      success: true,
      data: balanceData,
    });
  } catch (error) {
    console.error("Error getting organizer balance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get organizer balance",
      error: error.message,
    });
  }
};

// Create withdrawal request
const createWithdrawal = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    let organizerId;
    const { amount, notes, bankDetails } = req.body;
    const currency = req.body.currency === "USD" ? "USD" : "ETB";

    if (req.user.role === "admin") {
      organizerId = req.body.organizerId;
      if (!organizerId) {
        throw new BadRequestError(
          "Organizer ID is required for admin withdrawal creation"
        );
      }
    } else if (req.user.role === "organizer") {
      organizerId = req.user.userId;
    } else {
      throw new UnauthorizedError(
        "Only admins or organizers can create withdrawals"
      );
    }

    // Get available balance (match the calculation in getOrganizerBalance)
    const { availableBalance } = await calculateOrganizerBalance(
      organizerId,
      currency
    );

    // Validate amount
    if (amount > availableBalance) {
      throw new BadRequestError("Withdrawal amount exceeds available balance");
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      organizer: organizerId,
      amount,
      currency,
      notes,
      bankDetails,
      processedBy: req.user.role === "admin" ? req.user.userId : undefined,
      status: "pending",
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error creating withdrawal:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create withdrawal request",
      error: error.message,
    });
  }
};

// Update withdrawal status
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, notes, transactionId } = req.body;

    console.log("Updating withdrawal status:", {
      withdrawalId,
      status,
      notes,
      transactionId,
    });

    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    // Verify admin role
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can update withdrawal status");
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError("Withdrawal request not found");
    }

    console.log("Found withdrawal:", {
      id: withdrawal._id,
      organizer: withdrawal.organizer,
      amount: withdrawal.amount,
      currentStatus: withdrawal.status,
      newStatus: status,
    });

    // Update withdrawal
    withdrawal.status = status;
    withdrawal.notes = notes || withdrawal.notes;
    withdrawal.transactionId = transactionId || withdrawal.transactionId;
    withdrawal.processedBy = req.user.userId;
    withdrawal.processedAt = new Date();

    await withdrawal.save();
    console.log("Withdrawal updated successfully");

    // Emit notification
    const notification = await Notification.create({
      userId: withdrawal.organizer,
      type: "withdrawal_status_change",
      message: `Your withdrawal of ${withdrawal.amount} ${withdrawal.currency} has been ${withdrawal.status}.`,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      status: withdrawal.status,
      read: false,
    });
    console.log("Notification created:", notification._id);

    // Emit socket event to the organizer's room
    const io = req.app.get("io");
    if (io) {
      const roomName = `organizer_${withdrawal.organizer}`;
      console.log("Emitting to room:", roomName);
      io.to(roomName).emit("withdrawalStatusUpdated", {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
      });
      console.log("Socket event emitted");
    } else {
      console.log("Socket.IO not available");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal status:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update withdrawal status",
      error: error.message,
    });
  }
};

// Get all withdrawals (admin) - OPTIMIZED
const getAllWithdrawals = async (req, res) => {
  try {
    const { status, organizerId, page = 1, limit = 10 } = req.query;
    const currency = req.query.currency === "USD" ? "USD" : req.query.currency === "ETB" ? "ETB" : null;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && status !== "all") query.status = status;
    if (organizerId) query.organizer = organizerId;
    if (currency === "ETB") {
      query.$or = [{ currency: "ETB" }, { currency: { $exists: false } }];
    } else if (currency === "USD") {
      query.currency = "USD";
    }

    // Use Promise.all for parallel queries
    const [withdrawals, total, stats] = await Promise.all([
      // Get withdrawals with pagination using lean()
      Withdrawal.find(query)
        .populate("organizer", "firstName lastName email")
        .populate("processedBy", "firstName lastName email")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      
      // Get total count
      Withdrawal.countDocuments(query),
      
      // Get aggregated stats
      Withdrawal.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Format stats
    const statsFormatted = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    stats.forEach(stat => {
      if (statsFormatted[stat._id]) {
        statsFormatted[stat._id] = {
          count: stat.count,
          amount: stat.totalAmount
        };
      }
    });

    res.status(StatusCodes.OK).json({
      status: "success",
      data: withdrawals,
      stats: statsFormatted,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting withdrawals:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get withdrawals",
      error: error.message,
    });
  }
};

// Get organizer's withdrawals - OPTIMIZED
const getOrganizerWithdrawals = async (req, res) => {
  try {
    if (!req.user) {
      throw new UnauthorizedError("User not authenticated");
    }

    let organizerId = req.params.organizerId;
    // Only allow admin to view any organizer, organizers can only view their own
    if (req.user.role === "organizer") {
      organizerId = req.user.userId;
    }
    const { status, page = 1, limit = 10 } = req.query;
    const currency = req.query.currency === "USD" ? "USD" : req.query.currency === "ETB" ? "ETB" : null;
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizer: organizerId };
    if (status && status !== "all") query.status = status;
    if (currency === "ETB") {
      query.$or = [{ currency: "ETB" }, { currency: { $exists: false } }];
    } else if (currency === "USD") {
      query.currency = "USD";
    }

    // Use Promise.all for parallel queries
    const [withdrawals, total, stats] = await Promise.all([
      // Get withdrawals with pagination using lean()
      Withdrawal.find(query)
        .populate("processedBy", "firstName lastName email")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      
      // Get total count
      Withdrawal.countDocuments(query),
      
      // Get aggregated stats for this organizer
      Withdrawal.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Format stats
    const statsFormatted = {
      pending: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    stats.forEach(stat => {
      if (statsFormatted[stat._id]) {
        statsFormatted[stat._id] = {
          count: stat.count,
          amount: stat.totalAmount
        };
      }
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      stats: statsFormatted,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error getting organizer withdrawals:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get organizer withdrawals",
      error: error.message,
    });
  }
};

module.exports = {
  getOrganizerBalance,
  createWithdrawal,
  updateWithdrawalStatus,
  getAllWithdrawals,
  getOrganizerWithdrawals,
};
