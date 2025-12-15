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

// Get organizer's available balance
const getOrganizerBalance = async (req, res) => {
  try {
    const { organizerId } = req.params;

    // Get all events by this organizer
    const events = await Event.find({ organizer: organizerId });
    const eventIds = events.map((event) => event._id);

    // Calculate revenue from tickets
    // Count all tickets that represent actual revenue (active, used, etc.) excluding cancelled/expired/pending
    // Also exclude invitations as they are free and shouldn't count as purchased
    // Match frontend logic: Include ALL On-Door tickets (regardless of payment status), but restrict Online tickets
    const tickets = await Ticket.find({
      event: { $in: eventIds },
      status: { $nin: ["cancelled", "expired", "pending"] },
      $or: [
        { isOnDoor: true },
        {
          paymentStatus: "completed",
          isInvitation: { $ne: true }, // Handle cases where isInvitation is false or undefined
          price: { $gt: 0 }, // Ensure price is greater than 0 for online tickets
        },
      ],
    }).populate("event", "title ticketTypes");

    // Helper to calculate ticket quantity
    const getQuantity = (ticket, event) => {
      if (ticket.purchaseQuantity) return ticket.purchaseQuantity;
      if (ticket.ticketCount) return ticket.ticketCount;

      // Fallback: calculate from price
      if (event && event.ticketTypes) {
        const type = event.ticketTypes.find(
          (tt) =>
            tt.name === ticket.ticketType ||
            tt._id.toString() === ticket.ticketType
        );
        // If we found the type and both prices are valid
        if (type && type.price > 0 && ticket.price > 0) {
          // Calculate quantity based on total price paid vs unit price
          const calculatedQty = Math.round(ticket.price / type.price);
          return calculatedQty > 0 ? calculatedQty : 1;
        }
      }
      return 1;
    };

    // Calculate total revenue and breakdown by event
    const revenueBreakdown = events.map((event) => {
      const eventTickets = tickets.filter(
        (ticket) => ticket.event._id.toString() === event._id.toString()
      );

      const eventRevenue = eventTickets.reduce(
        (sum, ticket) => sum + ticket.price,
        0
      );

      // Get ticket type breakdown
      const ticketTypeBreakdown = event.ticketTypes.map((ticketType) => {
        const typeTickets = eventTickets.filter(
          (t) =>
            t.ticketType === ticketType.name ||
            t.ticketType === ticketType._id.toString()
        );
        const typeRevenue = typeTickets.reduce((sum, t) => sum + t.price, 0);
        const quantitySold = typeTickets.reduce(
          (sum, t) => sum + getQuantity(t, event),
          0
        );

        return {
          name: ticketType.name,
          price: ticketType.price,
          quantitySold,
          revenue: typeRevenue,
        };
      });

      const totalTicketsSold = eventTickets.reduce(
        (sum, t) => sum + getQuantity(t, event),
        0
      );

      // Calculate On-Door vs Online stats
      const onDoorTickets = eventTickets.filter((t) => t.isOnDoor);
      const onlineTickets = eventTickets.filter((t) => !t.isOnDoor);

      const onDoorTicketsSold = onDoorTickets.reduce(
        (sum, t) => sum + getQuantity(t, event),
        0
      );
      const onDoorRevenue = onDoorTickets.reduce((sum, t) => sum + t.price, 0);

      const onlineTicketsSold = onlineTickets.reduce(
        (sum, t) => sum + getQuantity(t, event),
        0
      );
      const onlineRevenue = onlineTickets.reduce((sum, t) => sum + t.price, 0);

      return {
        eventId: event._id,
        eventTitle: event.title,
        totalRevenue: eventRevenue,
        ticketTypeBreakdown,
        totalTicketsSold,
        onDoorTicketsSold,
        onDoorRevenue,
        onlineTicketsSold,
        onlineRevenue,
      };
    });

    // Calculate total revenue across all events
    const totalRevenue = revenueBreakdown.reduce(
      (sum, event) => sum + event.totalRevenue,
      0
    );

    // Calculate revenue breakdown by ticket status
    const statusBreakdown = {
      active: tickets
        .filter((t) => t.status === "active")
        .reduce((sum, t) => sum + t.price, 0),
      used: tickets
        .filter((t) => t.status === "used")
        .reduce((sum, t) => sum + t.price, 0),
      confirmed: tickets
        .filter((t) => t.status === "confirmed")
        .reduce((sum, t) => sum + t.price, 0),
    };

    // Calculate organizer revenue after 3% Pazimo commission
    const pazimoCommission = totalRevenue * 0.03;
    const organizerRevenue = totalRevenue * 0.97;

    // Get pending and approved withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: "pending",
    });

    const approvedWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: "approved",
    });

    const pendingAmount = pendingWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );
    const approvedAmount = approvedWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );

    // Available balance = organizer revenue - (pending + approved withdrawals)
    const availableBalance =
      organizerRevenue - (pendingAmount + approvedAmount);

    // Calculate total tickets sold across all events (sum of quantities)
    const totalTicketsSold = tickets.reduce(
      (sum, t) => sum + getQuantity(t, t.event),
      0
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalRevenue,
        organizerRevenue,
        pazimoCommission,
        pendingWithdrawals: pendingAmount,
        approvedWithdrawals: approvedAmount,
        availableBalance,
        revenueBreakdown,
        statusBreakdown,
        summary: {
          totalEvents: events.length,
          totalTicketsSold,
          averageTicketPrice:
            totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0,
        },
      },
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
    const events = await Event.find({ organizer: organizerId });
    const eventIds = events.map((event) => event._id);
    const tickets = await Ticket.find({
      event: { $in: eventIds },
      status: { $nin: ["cancelled", "expired", "pending"] },
      paymentStatus: "completed",
      isInvitation: false,
    });
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    // Calculate organizer revenue after 3% Pazimo commission
    const organizerRevenue = totalRevenue * 0.97;

    const pendingWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: "pending",
    });
    const approvedWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: "approved",
    });

    const pendingAmount = pendingWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );
    const approvedAmount = approvedWithdrawals.reduce(
      (sum, w) => sum + w.amount,
      0
    );
    const availableBalance =
      organizerRevenue - (pendingAmount + approvedAmount);

    // Validate amount
    if (amount > availableBalance) {
      throw new BadRequestError("Withdrawal amount exceeds available balance");
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      organizer: organizerId,
      amount,
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
      message: `Your withdrawal of ${withdrawal.amount} Birr has been ${withdrawal.status}.`,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
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

// Get all withdrawals (admin)
const getAllWithdrawals = async (req, res) => {
  try {
    const { status, organizerId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && status !== "all") query.status = status;
    if (organizerId) query.organizer = organizerId;

    // Get withdrawals with pagination
    const withdrawals = await Withdrawal.find(query)
      .populate("organizer", "firstName lastName email")
      .populate("processedBy", "firstName lastName email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Withdrawal.countDocuments(query);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: withdrawals,
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

// Get organizer's withdrawals
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
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizer: organizerId };
    if (status && status !== "all") query.status = status;

    // Get withdrawals with pagination
    const withdrawals = await Withdrawal.find(query)
      .populate("processedBy", "firstName lastName email")
      .sort("-createdAt")
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Withdrawal.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
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
