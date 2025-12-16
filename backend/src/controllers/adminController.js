const User = require("../models/User");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const { StatusCodes } = require("http-status-codes");

// Get admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();

    // Get total events
    const totalEvents = await Event.countDocuments();

    // Get active events (published)
    const activeEvents = await Event.countDocuments({ status: "published" });

    // Get total revenue from tickets
    const tickets = await Ticket.find({
      paymentStatus: "completed",
      isInvitation: { $ne: true },
    }).populate("event");

    const totalRevenue = tickets.reduce(
      (sum, ticket) => sum + (ticket.price || 0),
      0
    );

    const totalTicketsSold = tickets.reduce((sum, ticket) => {
      let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

      // Strict check: if price doesn't match quantity * unit_price, recalculate
      if (ticket.event && ticket.event.ticketTypes) {
        const type = ticket.event.ticketTypes.find(
          (tt) =>
            tt.name === ticket.ticketType ||
            tt._id.toString() === ticket.ticketType ||
            (tt.name &&
              ticket.ticketType &&
              tt.name.toLowerCase() === ticket.ticketType.toLowerCase())
        );

        if (type && type.price > 0 && ticket.price > 0) {
          const expectedPrice = quantity * type.price;
          // If the difference is significant (more than 1 unit of currency/rounding error)
          if (Math.abs(expectedPrice - ticket.price) > 1) {
            const calculatedQty = Math.round(ticket.price / type.price);
            if (calculatedQty > 0) {
              quantity = calculatedQty;
            }
          }
        }
      }

      return sum + quantity;
    }, 0);

    // Get active organizers
    const activeOrganizers = await User.countDocuments({ role: "organizer" });

    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({
      status: "pending",
    });

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        totalUsers,
        totalEvents,
        totalRevenue,
        totalTicketsSold,
        activeOrganizers,
        activeEvents,
        pendingWithdrawals,
      },
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get dashboard statistics",
    });
  }
};

const getRevenueChartData = async (req, res) => {
  try {
    const revenueData = await Ticket.aggregate([
      {
        $match: { paymentStatus: "completed" },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalRevenue: { $sum: "$price" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formattedData = revenueData.map((item) => ({
      name: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      revenue: item.totalRevenue,
    }));

    res.status(StatusCodes.OK).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error getting revenue chart data:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get revenue chart data",
    });
  }
};

const getEventRegistrationsChartData = async (req, res) => {
  try {
    const eventData = await Event.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          eventCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formattedData = eventData.map((item) => ({
      name: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      count: item.eventCount,
    }));

    res.status(StatusCodes.OK).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error getting event registrations chart data:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get event registrations chart data",
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueChartData,
  getEventRegistrationsChartData,
};
