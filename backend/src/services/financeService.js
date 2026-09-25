const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const Loan = require("../models/Loan");
const mongoose = require("mongoose");
const { getOrganizerLoanFinance } = require("./loanRepaymentService");
const {
  getOrganizerEvents,
  organizerTicketMatch,
  TICKET_QUANTITY_EXPR,
  revenueAccumulators,
} = require("../utils/ticketRevenueQuery");
const { round2 } = require("../config/rates");
const {
  getOrganizerBeverageRevenue,
} = require("../utils/beverageRevenueQuery");

const calculateOrganizerBalance = async (organizerId, currency = "ETB") => {
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";

  // Resolve the organizer's events first, then match tickets by event id.
  //
  // This pipeline used to begin with a $lookup into events, $unwind, and only
  // then $match on eventData.organizer — which meant Mongo scanned every ticket
  // in the collection and did one event lookup per row before discarding almost
  // all of them. No index can help a filter that runs after a join. Fetching
  // event ids up front uses Event { organizer: 1 }, and the resulting
  // `event: { $in: [...] }` uses the ticket indexes that lead with `event`.
  //
  // Event titles and ticketTypes came from the joined document; they now come
  // from this same query, joined in memory afterwards.
  const events = await getOrganizerEvents(organizerId, "_id title ticketTypes");
  const eventIds = events.map((e) => e._id);
  const eventById = new Map(events.map((e) => [String(e._id), e]));

  const balanceData = eventIds.length
    ? await Ticket.aggregate([
        { $match: organizerTicketMatch(eventIds, normalizedCurrency) },
        // Normalize ticket quantity to account for multi-person tickets
        { $addFields: { ticketQuantity: TICKET_QUANTITY_EXPR } },
        {
          $facet: {
            revenue: [
              {
                $group: {
                  _id: null,
                  totalTickets: { $sum: "$ticketQuantity" },
                  // Commission varies per event and is snapshotted per ticket,
                  // so these are summed row by row rather than derived from
                  // totalRevenue with a single rate.
                  ...revenueAccumulators(),
                },
              },
            ],
            statusBreakdown: [
              { $group: { _id: "$status", revenue: { $sum: "$price" } } },
            ],
            eventBreakdown: [
              {
                $group: {
                  _id: "$event",
                  totalRevenue: { $sum: "$price" },
                  ticketsSold: { $sum: "$ticketQuantity" },
                  onDoorRevenue: { $sum: { $cond: ["$isOnDoor", "$price", 0] } },
                  onlineRevenue: {
                    $sum: { $cond: [{ $not: "$isOnDoor" }, "$price", 0] },
                  },
                  onDoorTickets: {
                    $sum: { $cond: ["$isOnDoor", "$ticketQuantity", 0] },
                  },
                  onlineTickets: {
                    $sum: { $cond: [{ $not: "$isOnDoor" }, "$ticketQuantity", 0] },
                  },
                },
              },
            ],
            typeBreakdown: [
              {
                $group: {
                  _id: {
                    eventId: "$event",
                    ticketType: "$ticketType",
                    isOnDoor: { $eq: ["$isOnDoor", true] },
                  },
                  totalSold: { $sum: "$ticketQuantity" },
                  totalRevenue: { $sum: "$price" },
                },
              },
            ],
            eventCount: [{ $group: { _id: "$event" } }, { $count: "total" }],
          },
        },
      ])
    : [];

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
        // Rows written before the split have no stream and are ticket revenue.
        _id: { $ifNull: ["$stream", "tickets"] },
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
  const revenueData = balanceData[0]?.revenue[0] || {};
  const totalRevenue = revenueData.grossRevenue || 0;
  const totalTicketsSold = revenueData.totalTickets || 0;

  // Per-event commission, the 15% VAT charged on it, and — on events where
  // Pazimo covers the organizer's own VAT — a further 15% of gross withheld for
  // the government. All accumulated per ticket at the rates that ticket was
  // sold under, so flipping either setting never restates a past sale.
  const pazimoCommission = round2(revenueData.pazimoCommission || 0);
  const vatOnCommission = round2(revenueData.vatOnCommission || 0);
  const organizerVat = round2(revenueData.organizerVat || 0);
  const totalDeduction = round2(pazimoCommission + vatOnCommission + organizerVat);
  const organizerRevenue = round2(revenueData.organizerRevenue || 0);
  const effectiveCommissionRate =
    totalRevenue > 0 ? pazimoCommission / totalRevenue : 0;

  // Withdrawals, split by the pool they drew from.
  const emptyWithdrawals = { pendingAmount: 0, approvedAmount: 0 };
  const withdrawalsByStream = new Map(withdrawalStats.map((r) => [r._id, r]));
  const ticketWithdrawals = withdrawalsByStream.get("tickets") || emptyWithdrawals;
  const beverageWithdrawals = withdrawalsByStream.get("beverages") || emptyWithdrawals;
  const capitalWithdrawals = withdrawalsByStream.get("capital") || emptyWithdrawals;

  // Kept for the combined view and for callers that predate the split.
  const pendingAmount = ticketWithdrawals.pendingAmount + beverageWithdrawals.pendingAmount;
  const approvedAmount = ticketWithdrawals.approvedAmount + beverageWithdrawals.approvedAmount;

  // Pazimo Capital position. The advance's principal lives in its OWN pool
  // (see capitalAvailableBalance below) — it never touches the ticket
  // balance. Only repayment does: 60% of gross ticket sales made after the
  // advance was approved is diverted away from the organizer automatically.
  // That 60% cut is exactly `totalRepaidFromTickets`, subtracted below, which
  // leaves the organizer with the other ~40% of those sales (less the
  // commission+VAT already baked into organizerRevenue) — matching the spec.
  const loanFinance = await getOrganizerLoanFinance(organizerId, normalizedCurrency);

  // Beverage sales are a separate reporting stream but the same pool of money:
  // an organizer withdraws one balance, not two. Until this landed, drink
  // revenue was recorded and then never reachable — no balance, no payout, and
  // no commission taken. USD has no beverage sales (BeverageSale is ETB-only),
  // so the lookup is skipped rather than returning zeroes from a scan.
  const beverage =
    normalizedCurrency === "ETB"
      ? await getOrganizerBeverageRevenue(organizerId, "ETB")
      : { grossRevenue: 0, pazimoCommission: 0, vatOnCommission: 0,
          organizerVat: 0, organizerRevenue: 0, unitsSold: 0, salesCount: 0 };

  // Calculate available balance
  // Three pools, drawn independently.
  //
  // Pazimo Capital's advance is underwritten against event revenue and
  // repaid from a cut of ticket sales, but the PRINCIPAL ITSELF is its own
  // pool (capitalAvailableBalance, below) — it is credited once at approval,
  // not earned per sale, and must never inflate the ticket balance, the
  // ticket ledger or the admin ticket dashboard. Only the automatic 60%
  // repayment cut touches ticket money, via totalRepaidFromTickets below.
  // Bar takings neither fund nor repay a loan, which is what lets an
  // organizer with an outstanding advance still settle bar money.
  const ticketAvailableBalance = round2(
    Math.max(
      0,
      organizerRevenue -
        loanFinance.totalRepaidFromTickets -
        (ticketWithdrawals.pendingAmount + ticketWithdrawals.approvedAmount)
    )
  );

  // Floored at 0 for the same reason as ticketAvailableBalance above — a
  // historical accounting gap must never surface as a negative bar balance.
  const beverageAvailableBalance = round2(
    Math.max(
      0,
      beverage.organizerRevenue -
        (beverageWithdrawals.pendingAmount + beverageWithdrawals.approvedAmount)
    )
  );

  // What's left of the disbursed principal that the organizer hasn't yet
  // withdrawn. Repayment does NOT reduce this — it reduces the debt
  // (loanFinance.outstandingDebt), which is a different question. Clamped at
  // 0 as a backstop: it should never go negative in ordinary operation, but a
  // historical organizer who withdrew some of this principal through the old,
  // mixed ticket pool needs a one-time reconciling entry (see
  // scripts/migrateCapitalPoolSeparation.js) or this floors to 0 instead of
  // going negative.
  const capitalAvailableBalance = round2(
    Math.max(
      0,
      loanFinance.principalCredited -
        (capitalWithdrawals.pendingAmount + capitalWithdrawals.approvedAmount)
    )
  );

  // The historical field name. Still the ticket pool, because every existing
  // caller — the withdrawals screen, the admin list, the organizer dashboard —
  // means "what can be withdrawn from ticket sales" by it.
  const availableBalance = ticketAvailableBalance;

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
    const eventTicketTypes = eventById.get(eventKey)?.ticketTypes;
    typeBreakdownByEvent.get(eventKey).push({
      ticketType: resolveTicketTypeName(item._id.ticketType, eventTicketTypes),
      isOnDoor: item._id.isOnDoor,
      totalSold: item.totalSold,
      totalRevenue: item.totalRevenue,
      pricePerTicket: item.totalSold > 0 ? item.totalRevenue / item.totalSold : 0
    });
  });

  // Format revenue breakdown by event
  const revenueBreakdown = (balanceData[0]?.eventBreakdown || []).map(item => ({
    eventId: item._id,
    eventTitle: eventById.get(String(item._id))?.title,
    totalRevenue: item.totalRevenue,
    totalTicketsSold: item.ticketsSold,
    onDoorRevenue: item.onDoorRevenue,
    onDoorTicketsSold: item.onDoorTickets,
    onlineRevenue: item.onlineRevenue,
    onlineTicketsSold: item.onlineTickets,
    ticketTypeBreakdown: typeBreakdownByEvent.get(String(item._id)) || []
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

  const beverageOrganizerVat = round2(beverage.organizerVat || 0);

  return {
    currency: normalizedCurrency,
    totalRevenue,
    organizerRevenue,
    pazimoCommission,
    vatOnCommission,
    // VAT withheld from this organizer and owed to the government. Reported
    // separately everywhere: it is neither the organizer's money nor Pazimo's.
    organizerVat,
    totalDeduction,
    // Blended rate across this organizer's events, for display.
    effectiveCommissionRate,

    // The two revenue streams, reported separately because organizers and
    // admins want them split — and combined, because the balance is one pool.
    streams: {
      tickets: {
        availableBalance: ticketAvailableBalance,
        pendingWithdrawals: round2(ticketWithdrawals.pendingAmount),
        approvedWithdrawals: round2(ticketWithdrawals.approvedAmount),
        grossRevenue: totalRevenue,
        organizerRevenue,
        pazimoCommission,
        vatOnCommission,
        organizerVat,
        pazimoCollected: totalDeduction,
        ticketsSold: totalTicketsSold,
      },
      beverages: {
        availableBalance: beverageAvailableBalance,
        pendingWithdrawals: round2(beverageWithdrawals.pendingAmount),
        approvedWithdrawals: round2(beverageWithdrawals.approvedAmount),
        grossRevenue: round2(beverage.grossRevenue),
        organizerRevenue: round2(beverage.organizerRevenue),
        pazimoCommission: round2(beverage.pazimoCommission),
        vatOnCommission: round2(beverage.vatOnCommission),
        organizerVat: beverageOrganizerVat,
        pazimoCollected: round2(
          beverage.pazimoCommission + beverage.vatOnCommission + beverageOrganizerVat
        ),
        unitsSold: beverage.unitsSold,
        salesCount: beverage.salesCount,
      },
      // Pazimo Capital's own pool — completely separate from ticket sales.
      // Disbursement lands here, not in `tickets`; approving a withdrawal
      // from this pool never touches the ticket balance or ledger. Repayment
      // (totalRepaidFromTickets) is reported here for context but is already
      // reflected in `tickets.availableBalance`, not in this pool.
      capital: {
        availableBalance: capitalAvailableBalance,
        pendingWithdrawals: round2(capitalWithdrawals.pendingAmount),
        approvedWithdrawals: round2(capitalWithdrawals.approvedAmount),
        principalCredited: loanFinance.principalCredited,
        totalRepaidFromTickets: loanFinance.totalRepaidFromTickets,
        outstandingDebt: loanFinance.outstandingDebt,
      },
    },
    combined: {
      grossRevenue: round2(totalRevenue + beverage.grossRevenue),
      organizerRevenue: round2(organizerRevenue + beverage.organizerRevenue),
      organizerVat: round2(organizerVat + beverageOrganizerVat),
      pazimoCollected: round2(
        totalDeduction +
          beverage.pazimoCommission +
          beverage.vatOnCommission +
          beverageOrganizerVat
      ),
    },

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
    vatOnCommission,
    totalDeduction,
    // Blended rate across this organizer's events, for display.
    effectiveCommissionRate,

    // The two revenue streams, reported separately because organizers and
    // admins want them split — and combined, because the balance is one pool.
    streams: {
      tickets: {
        availableBalance: ticketAvailableBalance,
        pendingWithdrawals: round2(ticketWithdrawals.pendingAmount),
        approvedWithdrawals: round2(ticketWithdrawals.approvedAmount),
        grossRevenue: totalRevenue,
        organizerRevenue,
        pazimoCommission,
        vatOnCommission,
        pazimoCollected: totalDeduction,
        ticketsSold: totalTicketsSold,
      },
      beverages: {
        availableBalance: beverageAvailableBalance,
        pendingWithdrawals: round2(beverageWithdrawals.pendingAmount),
        approvedWithdrawals: round2(beverageWithdrawals.approvedAmount),
        grossRevenue: round2(beverage.grossRevenue),
        organizerRevenue: round2(beverage.organizerRevenue),
        pazimoCommission: round2(beverage.pazimoCommission),
        vatOnCommission: round2(beverage.vatOnCommission),
        pazimoCollected: round2(beverage.pazimoCommission + beverage.vatOnCommission),
        unitsSold: beverage.unitsSold,
        salesCount: beverage.salesCount,
      },
    },
    combined: {
      grossRevenue: round2(totalRevenue + beverage.grossRevenue),
      organizerRevenue: round2(organizerRevenue + beverage.organizerRevenue),
      pazimoCollected: round2(
        totalDeduction + beverage.pazimoCommission + beverage.vatOnCommission
      ),
    },

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

/**
 * One venue's balance.
 *
 * A deliberate sibling of calculateOrganizerBalance rather than a branch inside
 * it. That function is built around events: it resolves the organizer's events,
 * scans tickets by event id, and folds in Pazimo Capital, none of which a venue
 * has. Threading a "is this a venue?" flag through all of it would leave every
 * ticket and loan path one forgotten condition away from touching venue money.
 *
 * A venue has exactly one pool — drinks — so the shape is much smaller. It is
 * still reported under `streams.venueBeverages` so callers read a venue balance
 * the same way they read the other two, and `availableBalance` means the same
 * thing everywhere: what this account may withdraw right now.
 *
 * Pazimo Capital does not reach this pool. Advances are underwritten against
 * event ticket revenue; a venue has none.
 */
const calculateVenueBalance = async (venueId, currency = "ETB") => {
  // Required here rather than at the top of the file: financeService is loaded
  // by controllers that predate the venue channel, and a top-level require
  // would pull the venue models into every one of them.
  const {
    getVenueBeverageRevenue,
  } = require("../utils/venueBeverageRevenueQuery");

  // VenueBeverageSale is ETB-only (the currency enum has one value), so a USD
  // request returns an empty stream rather than running a pointless scan — the
  // same decision calculateOrganizerBalance makes for the beverage stream.
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";
  const revenue =
    normalizedCurrency === "ETB"
      ? await getVenueBeverageRevenue(venueId, "ETB")
      : {
          grossRevenue: 0,
          pazimoCommission: 0,
          vatOnCommission: 0,
          venueVat: 0,
          venueRevenue: 0,
          unitsSold: 0,
          salesCount: 0,
        };

  // Scoped by `venue` AND by stream. Either alone would be enough today, but
  // both together mean a row can only be counted against this pool if it was
  // explicitly written as a venue payout for this venue.
  const [withdrawalRow] = await Withdrawal.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(String(venueId)),
        stream: "venue_beverages",
      },
    },
    {
      $group: {
        _id: null,
        pending: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
        },
        approved: {
          $sum: {
            $cond: [{ $in: ["$status", ["approved", "completed"]] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  const pendingWithdrawals = round2(withdrawalRow?.pending || 0);
  const approvedWithdrawals = round2(withdrawalRow?.approved || 0);
  const venueRevenue = round2(revenue.venueRevenue || 0);
  const venueVat = round2(revenue.venueVat || 0);

  const availableBalance = round2(
    venueRevenue - pendingWithdrawals - approvedWithdrawals
  );

  return {
    currency: normalizedCurrency,
    availableBalance,
    pendingWithdrawals,
    approvedWithdrawals,
    streams: {
      venueBeverages: {
        availableBalance,
        pendingWithdrawals,
        approvedWithdrawals,
        grossRevenue: round2(revenue.grossRevenue),
        venueRevenue,
        pazimoCommission: round2(revenue.pazimoCommission),
        vatOnCommission: round2(revenue.vatOnCommission),
        // Withheld for the government, never Pazimo revenue — reported on its
        // own for the same reason the event side reports organizerVat apart.
        venueVat,
        pazimoCollected: round2(
          revenue.pazimoCommission + revenue.vatOnCommission + venueVat
        ),
        unitsSold: revenue.unitsSold,
        salesCount: revenue.salesCount,
      },
    },
  };
};

module.exports = {
  calculateOrganizerBalance,
  calculateOrganizerBalanceLegacy,
  calculateVenueBalance,
};
