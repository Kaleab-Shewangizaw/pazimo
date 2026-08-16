const User = require("../models/User");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const { StatusCodes } = require("http-status-codes");
const { revenueAccumulators } = require("../utils/ticketRevenueQuery");

// Get admin dashboard statistics (OPTIMIZED)
const getDashboardStats = async (req, res) => {
  try {
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const withdrawalCurrencyMatch =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };
    // Run all count queries in parallel for better performance
    const [
      totalUsers,
      totalEvents,
      activeEvents,
      activeOrganizers,
      revenueStats,
      withdrawalStats,
    ] = await Promise.all([
      User.countDocuments(),
      Event.countDocuments(),
      Event.countDocuments({ status: "published" }),
      User.countDocuments({ role: "organizer" }),
      // Use aggregation to calculate revenue and ticket counts in one query
      Ticket.aggregate([
        {
          $facet: {
            // Calculate gross revenue (only tickets with price > 0)
            revenue: [
              {
                $match: {
                  ...(currency === "ETB"
                    ? {
                        $or: [
                          { currency: "ETB" },
                          { currency: { $exists: false } },
                        ],
                      }
                    : { currency }),
                  price: { $gt: 0 },
                },
              },
              {
                $group: {
                  _id: null,
                  ...revenueAccumulators(),
                },
              },
            ],
            // Calculate total tickets sold (ALL non-invitation tickets, including free)
            ticketsSold: [
              {
                $match: {
                  isInvitation: { $ne: true },
                  status: { $nin: ["cancelled", "failed", "expired"] },
                },
              },
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: {
                      $cond: [
                        { $gt: ["$purchaseQuantity", 0] },
                        "$purchaseQuantity",
                        { $cond: [{ $gt: ["$ticketCount", 0] }, "$ticketCount", 1] },
                      ],
                    },
                  },
                  count: { $sum: 1 },
                },
              },
            ],
            // Get total ticket records for debugging
            allTickets: [
              {
                $group: {
                  _id: null,
                  totalRecords: { $sum: 1 },
                  invitationCount: {
                    $sum: { $cond: [{ $eq: ["$isInvitation", true] }, 1, 0] },
                  },
                },
              },
            ],
          },
        },
      ]),
      // Use aggregation for withdrawal stats
      Withdrawal.aggregate([
        {
          $facet: {
            withdrawn: [
              {
                $match: {
                  ...withdrawalCurrencyMatch,
                  status: { $in: ["approved", "completed"] },
                },
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: "$amount" },
                },
              },
            ],
            pending: [
              {
                $match: {
                  ...withdrawalCurrencyMatch,
                  status: "pending",
                },
              },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  amount: { $sum: "$amount" },
                },
              },
            ],
          },
        },
      ]),
    ]);

    // Extract aggregation results
    const grossRevenue = revenueStats[0]?.revenue[0]?.grossRevenue || 0;
    const totalTicketsSold = revenueStats[0]?.ticketsSold[0]?.total || 0;
    const ticketRecordsCount = revenueStats[0]?.ticketsSold[0]?.count || 0;
    const allTicketsData = revenueStats[0]?.allTickets[0] || {};

    // Log for debugging
    console.log('📊 Admin Dashboard Stats:', {
      totalTicketRecords: allTicketsData.totalRecords || 0,
      invitationCount: allTicketsData.invitationCount || 0,
      validTicketRecords: ticketRecordsCount,
      totalQuantitySold: totalTicketsSold,
      grossRevenue
    });

    const totalWithdrawn = withdrawalStats[0]?.withdrawn[0]?.total || 0;
    const pendingWithdrawalsAmount =
      withdrawalStats[0]?.pending[0]?.amount || 0;
    const pendingWithdrawals = withdrawalStats[0]?.pending[0]?.count || 0;

    // The split comes from the aggregation, accumulated per ticket at the rates
    // that ticket was sold under. It used to be grossRevenue * 0.97 / 0.03,
    // which was already wrong for any event off the 3% default and is wildly
    // wrong for one whose VAT Pazimo covers — there the organizer keeps 81.55%.
    const totalRevenue = grossRevenue;
    const organizerRevenue = revenueStats[0]?.revenue[0]?.organizerRevenue || 0;
    const pazimoCommission = revenueStats[0]?.revenue[0]?.pazimoCommission || 0;
    const vatOnCommission = revenueStats[0]?.revenue[0]?.vatOnCommission || 0;
    const organizerVat = revenueStats[0]?.revenue[0]?.organizerVat || 0;

    // Calculate available balance (Global)
    const availableBalance =
      organizerRevenue - totalWithdrawn - pendingWithdrawalsAmount;

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        currency,
        totalUsers,
        totalEvents,
        totalRevenue,
        organizerRevenue,
        pazimoCommission,
        // Both VAT lines are liabilities Pazimo holds and remits, kept apart
        // from pazimoCommission so the dashboard never reports tax as earnings.
        vatOnCommission,
        organizerVat,
        totalTicketsSold,
        activeOrganizers,
        activeEvents,
        pendingWithdrawals,
        totalWithdrawn,
        availableBalance,
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
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const revenueData = await Ticket.aggregate([
      {
        $match: {
          paymentStatus: "completed",
          ...(currency === "ETB"
            ? {
                $or: [{ currency: "ETB" }, { currency: { $exists: false } }],
              }
            : { currency }),
        },
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
      currency,
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

const getTicketSalesChartData = async (req, res) => {
  try {
    const ticketSalesData = await Ticket.aggregate([
      {
        $match: {
          isInvitation: { $ne: true },
          status: { $nin: ["cancelled", "failed", "expired"] },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          ticketsSold: {
            $sum: {
              $cond: [
                { $gt: ["$purchaseQuantity", 0] },
                "$purchaseQuantity",
                { $cond: [{ $gt: ["$ticketCount", 0] }, "$ticketCount", 1] },
              ],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const formattedData = ticketSalesData.map((item) => ({
      name: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      ticketsSold: item.ticketsSold,
    }));

    res.status(StatusCodes.OK).json({
      status: "success",
      data: formattedData,
    });
  } catch (error) {
    console.error("Error getting ticket sales chart data:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get ticket sales chart data",
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueChartData,
  getEventRegistrationsChartData,
  getTicketSalesChartData,
};
