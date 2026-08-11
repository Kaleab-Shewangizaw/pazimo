const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const Loan = require("../models/Loan");
const mongoose = require("mongoose");
const { getOrganizerLoanFinance } = require("./loanRepaymentService");
const { splitTicketRevenue } = require("../config/rates");

const calculateOrganizerBalance = async (organizerId, currency = "ETB") => {
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
  // Use aggregation pipeline for much faster calculation
  const balanceData = await Ticket.aggregate([
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "eventData"
      }
    },
    {
      $unwind: "$eventData"
    },
    {
      $match: {
        "eventData.organizer": new mongoose.Types.ObjectId(organizerId),
        ...(normalizedCurrency === "ETB"
          ? {
              $or: [{ currency: "ETB" }, { currency: { $exists: false } }],
            }
          : { currency: normalizedCurrency }),
        price: { $gt: 0 },
        status: { $nin: ["cancelled", "failed", "expired"] },
        $or: [
          { paymentStatus: { $exists: false } },
          { paymentStatus: { $nin: ["cancelled", "failed"] } }
        ]
      }
    },
    // Normalize ticket quantity to account for multi-person tickets
    {
      $addFields: {
        ticketQuantity: {
          $cond: [
            { $gt: ["$purchaseQuantity", 0] },
            "$purchaseQuantity",
            {
              $cond: [
                { $gt: ["$ticketCount", 0] },
                "$ticketCount",
                1
              ]
            }
          ]
        }
      }
    },
    {
      $facet: {
        revenue: [
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$price" },
              totalTickets: { $sum: "$ticketQuantity" }
            }
          }
        ],
        statusBreakdown: [
          {
            $group: {
              _id: "$status",
              revenue: { $sum: "$price" }
            }
          }
        ],
        eventBreakdown: [
          {
            $group: {
              _id: {
                eventId: "$eventData._id",
                eventTitle: "$eventData.title"
              },
              totalRevenue: { $sum: "$price" },
              ticketsSold: { $sum: "$ticketQuantity" },
              onDoorRevenue: {
                $sum: { $cond: ["$isOnDoor", "$price", 0] }
              },
              onlineRevenue: {
                $sum: { $cond: [{ $not: "$isOnDoor" }, "$price", 0] }
              },
              onDoorTickets: {
                $sum: { $cond: ["$isOnDoor", "$ticketQuantity", 0] }
              },
              onlineTickets: {
                $sum: { $cond: [{ $not: "$isOnDoor" }, "$ticketQuantity", 0] }
              }
            }
          }
        ],
        typeBreakdown: [
          {
            $group: {
              _id: {
                eventId: "$eventData._id",
                ticketType: "$ticketType",
                isOnDoor: { $eq: ["$isOnDoor", true] }
              },
              totalSold: { $sum: "$ticketQuantity" },
              totalRevenue: { $sum: "$price" },
              eventTicketTypes: { $first: "$eventData.ticketTypes" }
            }
          }
        ],
        eventCount: [
          {
            $group: {
              _id: "$eventData._id"
            }
          },
          {
            $count: "total"
          }
        ]
      }
    }
  ]);

  // Get withdrawal stats in parallel
  const withdrawalCurrencyMatch =
    normalizedCurrency === "ETB"
      ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
      : { currency: normalizedCurrency };

  // Borrowed Pazimo Capital principal is now credited straight into this one
  // available balance (no separate "Borrowed Funds" pool), so every withdrawal
  // — whatever its historical `source` — draws this single balance down.
  const withdrawalStats = await Withdrawal.aggregate([
    {
      $match: {
        organizer: new mongoose.Types.ObjectId(organizerId),
        ...withdrawalCurrencyMatch,
      }
    },
    {
      $group: {
        _id: null,
        pendingAmount: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] }
        },
        approvedAmount: {
          $sum: {
            $cond: [
              { $in: ["$status", ["approved", "completed"]] },
              "$amount",
              0
            ]
          }
        }
      }
    }
  ]);

  // Extract results
  const revenueData = balanceData[0]?.revenue[0] || { totalRevenue: 0, totalTickets: 0 };
  const totalRevenue = revenueData.totalRevenue;
  const totalTicketsSold = revenueData.totalTickets;

  // Commission, the VAT charged on that commission, and what's left for the
  // organizer. See config/rates — the organizer keeps 96.55%, not 97%, because
  // the 15% VAT on Pazimo's 3% fee is passed through.
  const {
    pazimoCommission,
    vatOnCommission,
    totalDeduction,
    organizerRevenue,
  } = splitTicketRevenue(totalRevenue);

  // Get withdrawal amounts
  const withdrawalData = withdrawalStats[0] || { pendingAmount: 0, approvedAmount: 0 };
  const pendingAmount = withdrawalData.pendingAmount;
  const approvedAmount = withdrawalData.approvedAmount;

  // Pazimo Capital position. Borrowed principal is added to the withdrawable
  // balance (the organizer spends it like their own money); repayment is then
  // taken automatically as 60% of gross ticket sales made after the advance
  // was approved. That 60% cut is exactly `totalRepaidFromTickets`, so
  // subtracting it here leaves the organizer with 36.55% of those sales — the
  // 3.45% commission+VAT is already baked into organizerRevenue.
  const loanFinance = await getOrganizerLoanFinance(organizerId, normalizedCurrency);

  // Calculate available balance
  const availableBalance =
    organizerRevenue +
    loanFinance.principalCredited -
    loanFinance.totalRepaidFromTickets -
    (pendingAmount + approvedAmount);

  // Format status breakdown
  const statusBreakdown = {};
  (balanceData[0]?.statusBreakdown || []).forEach(item => {
    statusBreakdown[item._id] = item.revenue;
  });

  // Group per-ticket-type totals by event. Tickets store ticketType as either
  // the type's name or its _id, so resolve to the display name when possible.
  const resolveTicketTypeName = (rawType, eventTicketTypes) => {
    if (!rawType) return "Unknown";
    const raw = String(rawType);
    const match = (eventTicketTypes || []).find(
      (tt) =>
        tt.name === raw ||
        (tt._id && tt._id.toString() === raw) ||
        (tt.name && tt.name.toLowerCase() === raw.toLowerCase())
    );
    return match ? match.name : raw;
  };

  const typeBreakdownByEvent = new Map();
  (balanceData[0]?.typeBreakdown || []).forEach(item => {
    const eventKey = item._id.eventId.toString();
    if (!typeBreakdownByEvent.has(eventKey)) {
      typeBreakdownByEvent.set(eventKey, []);
    }
    typeBreakdownByEvent.get(eventKey).push({
      ticketType: resolveTicketTypeName(item._id.ticketType, item.eventTicketTypes),
      isOnDoor: item._id.isOnDoor,
      totalSold: item.totalSold,
      totalRevenue: item.totalRevenue,
      pricePerTicket: item.totalSold > 0 ? item.totalRevenue / item.totalSold : 0
    });
  });

  // Format revenue breakdown by event
  const revenueBreakdown = (balanceData[0]?.eventBreakdown || []).map(item => ({
    eventId: item._id.eventId,
    eventTitle: item._id.eventTitle,
    totalRevenue: item.totalRevenue,
    totalTicketsSold: item.ticketsSold,
    onDoorRevenue: item.onDoorRevenue,
    onDoorTicketsSold: item.onDoorTickets,
    onlineRevenue: item.onlineRevenue,
    onlineTicketsSold: item.onlineTickets,
    ticketTypeBreakdown: typeBreakdownByEvent.get(item._id.eventId.toString()) || []
  }));

  const totalEvents = balanceData[0]?.eventCount[0]?.total || 0;

  // Log for debugging
  console.log(`💰 Balance calculated for organizer ${organizerId}:`, {
    currency: normalizedCurrency,
    totalEvents,
    totalTicketsSold,
    totalRevenue,
    organizerRevenue,
    availableBalance
  });

  return {
    currency: normalizedCurrency,
    totalRevenue,
    organizerRevenue,
    pazimoCommission,
    // VAT the government levies on pazimoCommission, passed through to the
    // organizer. totalDeduction = pazimoCommission + vatOnCommission.
    vatOnCommission,
    totalDeduction,
    pendingWithdrawals: pendingAmount,
    approvedWithdrawals: approvedAmount,
    availableBalance,
    // Pazimo Capital summary, exposed for display only (the numbers above
    // already reflect it). outstandingDebt is what the organizer still owes,
    // being repaid automatically from their ticket sales.
    loan: {
      currency: loanFinance.currency,
      principalCredited: loanFinance.principalCredited,
      totalRepaidFromTickets: loanFinance.totalRepaidFromTickets,
      outstandingDebt: loanFinance.outstandingDebt,
      activeLoan: loanFinance.activeLoan,
    },
    revenueBreakdown,
    statusBreakdown,
    summary: {
      totalEvents,
      totalTicketsSold,
      averageTicketPrice: totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0
    }
  };
};

module.exports = {
  calculateOrganizerBalance,
};
