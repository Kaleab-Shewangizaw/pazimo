const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");

const calculateOrganizerBalance = async (organizerId) => {
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
    // We exclude tickets with no price
    if (!t.price || t.price <= 0) return false;

    // Exclude cancelled or failed tickets
    // If status is undefined/null (legacy tickets), we include them
    if (t.status === "cancelled" || t.status === "failed") return false;
    if (t.paymentStatus === "failed" || t.paymentStatus === "cancelled")
      return false;

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
};
