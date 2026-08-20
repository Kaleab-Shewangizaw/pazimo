const User = require("../models/User");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const { StatusCodes } = require("http-status-codes");
const { revenueAccumulators } = require("../utils/ticketRevenueQuery");
const ledgerRead = require("../services/ledgerReadService");

// Get admin dashboard statistics (OPTIMIZED)
const getDashboardStats = async (req, res) => {
  try {
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const withdrawalCurrencyMatch =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };
    // Withdrawal.stream was added with the beverage channel and defaults to
    // "tickets", but rows written before the field existed have no value at
    // all — so "is a ticket payout" is "tickets or unset", never `stream:
    // "tickets"` alone, which would silently drop the platform's oldest payouts.
    const ticketStreamMatch = {
      $or: [{ stream: "tickets" }, { stream: { $exists: false } }],
    };
    // Combined under $and, NOT by spreading both objects into one. Both
    // conditions are `$or`s, and two `$or` keys in one object do not intersect —
    // the second silently replaces the first, which would drop the currency
    // filter entirely and sum USD payouts into the ETB figure.
    const ticketWithdrawalMatch = {
      $and: [withdrawalCurrencyMatch, ticketStreamMatch],
    };
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
      // Withdrawal stats.
      //
      // SCOPED TO `stream: "tickets"`. Without that filter these sums covered
      // every stream — event beverages, venue beverages, cinema seats, cinema
      // concessions — while the revenue side above counts ticket revenue only.
      // Subtracting one channel's payouts from another channel's revenue is what
      // drove availableBalance negative (-1,346.87 on the local database:
      // 273.13 ticket revenue less a 1,500.00 BEVERAGE withdrawal and 120.00
      // pending). Rows written before `stream` existed default to tickets, so
      // they are matched explicitly rather than dropped.
      //
      // The per-channel figures live on /admin/finance/partitions, which reads
      // the ledger. This one stays because the dashboard header still reports
      // the ticket pool.
      Withdrawal.aggregate([
        {
          $facet: {
            withdrawn: [
              {
                $match: {
                  ...ticketWithdrawalMatch,
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
                  ...ticketWithdrawalMatch,
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

/**
 * The money, split by pool — the admin dashboard's balance cards.
 *
 * Five partitions: event tickets, event beverages, venue beverages, cinema
 * tickets, cinema concessions. Each reports its own gross revenue, what the
 * seller earned, what Pazimo took, what has been paid out, what is pending, and
 * what is still available.
 *
 * REPLACES a single global "available balance" that subtracted payouts from
 * EVERY stream from TICKET revenue alone, and so went negative the moment
 * anyone withdrew beverage money. Pools are settled separately, so they are
 * reported separately; a single number across them could only ever be a sum of
 * things that are not interchangeable.
 *
 * ONE aggregation over LedgerBalance — one document per (owner, currency,
 * stream) — rather than five collection scans that re-derive commission and VAT
 * per row and grow with every sale.
 */
const getFinancePartitions = async (req, res) => {
  try {
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const result = await ledgerRead.getPlatformPartitions(currency);

    // Surfaced rather than swallowed: if the ledger has not been backfilled,
    // every figure above is a truthful 0.00 about an empty ledger and a lie
    // about the business. The client shows a warning instead of the cards.
    if (result.coverage && !result.coverage.backfilled) {
      console.warn(
        `[ADMIN-FINANCE] ledger is empty while ${result.coverage.sourceRows} source rows exist — run npm run ledger:backfill`
      );
    }

    res.status(StatusCodes.OK).json({ status: "success", data: result });
  } catch (error) {
    console.error("Error getting finance partitions:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to get finance partitions",
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
  getFinancePartitions,
  getRevenueChartData,
  getEventRegistrationsChartData,
  getTicketSalesChartData,
};
