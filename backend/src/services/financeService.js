const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const mongoose = require("mongoose");

const calculateOrganizerBalance = async (organizerId) => {
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
  const withdrawalStats = await Withdrawal.aggregate([
    {
      $match: {
        organizer: new mongoose.Types.ObjectId(organizerId)
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

  // Calculate commission and organizer revenue
  const pazimoCommission = totalRevenue * 0.03;
  const organizerRevenue = totalRevenue * 0.97;

  // Get withdrawal amounts
  const withdrawalData = withdrawalStats[0] || { pendingAmount: 0, approvedAmount: 0 };
  const pendingAmount = withdrawalData.pendingAmount;
  const approvedAmount = withdrawalData.approvedAmount;

  // Calculate available balance
  const availableBalance = organizerRevenue - (pendingAmount + approvedAmount);

  // Format status breakdown
  const statusBreakdown = {};
  (balanceData[0]?.statusBreakdown || []).forEach(item => {
    statusBreakdown[item._id] = item.revenue;
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
    onlineTicketsSold: item.onlineTickets
  }));

  const totalEvents = balanceData[0]?.eventCount[0]?.total || 0;

  // Log for debugging
  console.log(`💰 Balance calculated for organizer ${organizerId}:`, {
    totalEvents,
    totalTicketsSold,
    totalRevenue,
    organizerRevenue,
    availableBalance
  });

  return {
    totalRevenue,
    organizerRevenue,
    pazimoCommission,
    pendingWithdrawals: pendingAmount,
    approvedWithdrawals: approvedAmount,
    availableBalance,
    revenueBreakdown,
    statusBreakdown,
    summary: {
      totalEvents,
      totalTicketsSold,
      averageTicketPrice: totalTicketsSold > 0 ? totalRevenue / totalTicketsSold : 0
    }
  };
};

// Legacy version kept for reference
const calculateOrganizerBalanceLegacy = async (organizerId) => {
  // Get all events by this organizer
  const events = await Event.find({ organizer: organizerId });
  const eventIds = events.map((event) => event._id);

  // Get all tickets for these events
  const allTickets = await Ticket.find({
    event: { $in: eventIds },
  }).populate("event", "title ticketTypes");

  // Filter for Net Revenue (Withdrawal Calculation)
  // We exclude tickets with no price or invalid status
  const validTickets = allTickets.filter((t) => {
    // Always exclude tickets with no price
    if (!t.price || t.price <= 0) return false;

    // If status/paymentStatus are missing, treat as valid (legacy)
    const hasStatus = typeof t.status !== "undefined" && t.status !== null;
    const hasPaymentStatus =
      typeof t.paymentStatus !== "undefined" && t.paymentStatus !== null;

    // If either status or paymentStatus is present and failed/cancelled, exclude
    if (hasStatus && (t.status === "cancelled" || t.status === "failed"))
      return false;
    if (
      hasPaymentStatus &&
      (t.paymentStatus === "failed" || t.paymentStatus === "cancelled")
    )
      return false;

    // Otherwise, include
    return true;
  });

  // Use validTickets for ALL revenue calculations to ensure consistency
  const tickets = validTickets;

  // Helper to calculate ticket quantity
  const getQuantity = (ticket, event) => {
    let quantity = ticket.purchaseQuantity || ticket.ticketCount || 1;

    // Check if ticket was bought before Dec 14, 2025
    const cutoffDate = new Date("2025-12-14");
    const ticketDate = new Date(ticket.createdAt || ticket.purchaseDate);

    if (ticketDate < cutoffDate) {
      // Validate quantity against price if possible
      if (event && event.ticketTypes) {
        const type = event.ticketTypes.find(
          (tt) =>
            tt.name === ticket.ticketType ||
            tt._id.toString() === ticket.ticketType ||
            (tt.name &&
              ticket.ticketType &&
              tt.name.toLowerCase() === ticket.ticketType.toLowerCase())
        );

        // If we found the type and both prices are valid
        if (type && type.price > 0 && ticket.price > 0) {
          const expectedPrice = quantity * type.price;
          // If mismatch (allowing for small float diff), recalculate
          // This handles legacy data where quantity might be 1 but price is for multiple
          if (Math.abs(expectedPrice - ticket.price) > 1) {
            const calculatedQty = Math.round(ticket.price / type.price);
            if (calculatedQty > 0) return calculatedQty;
          }
        }
      }
    }

    return quantity;
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
    // Group tickets by type and price (to handle price changes)
    const ticketTypeBreakdown = [];
    for (const ticketType of event.ticketTypes) {
      // Find all tickets for this type
      const typeTickets = eventTickets.filter(
        (t) =>
          t.ticketType === ticketType.name ||
          t.ticketType === ticketType._id.toString()
      );
      // Group by price
      const priceMap = new Map();
      for (const t of typeTickets) {
        const price = t.price;
        if (!priceMap.has(price)) {
          priceMap.set(price, []);
        }
        priceMap.get(price).push(t);
      }
      for (const [price, ticketsAtPrice] of priceMap.entries()) {
        const quantitySold = ticketsAtPrice.reduce(
          (sum, t) => sum + getQuantity(t, event),
          0
        );
        const typeRevenue = ticketsAtPrice.reduce((sum, t) => sum + t.price, 0);
        ticketTypeBreakdown.push({
          name: ticketType.name,
          price,
          quantitySold,
          revenue: typeRevenue,
        });
      }
    }

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
  const withdrawals = await Withdrawal.find({
    organizer: organizerId,
  });

  const pendingAmount = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + w.amount, 0);

  const approvedAmount = withdrawals
    .filter((w) => w.status === "approved" || w.status === "completed")
    .reduce((sum, w) => sum + w.amount, 0);

  // Available balance = organizer revenue - (pending + approved withdrawals)
  const availableBalance = organizerRevenue - (pendingAmount + approvedAmount);

  // Calculate total tickets sold across all events (sum of quantities)
  const totalTicketsSold = tickets.reduce(
    (sum, t) => sum + getQuantity(t, t.event),
    0
  );

  return {
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
  };
};

module.exports = {
  calculateOrganizerBalance,
  calculateOrganizerBalanceLegacy,
};
