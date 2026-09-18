const mongoose = require("mongoose");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Loan = require("../models/Loan");
const OrganizerCapitalProfile = require("../models/OrganizerCapitalProfile");
const {
  validTicketMatch,
  getOrganizerEventIds,
  organizerTicketMatch,
} = require("../utils/ticketRevenueQuery");

const BORROW_RATE = 0.3; // 30% of the trailing revenue basis

// Events that have actually happened (not draft, not cancelled, end date in
// the past) — Event.status never automatically transitions to "completed" in
// this codebase, so gating on that status alone would leave every organizer
// stuck at a zero limit. endDate is optional on Event, so startDate is the
// fallback ordering/cutoff key.
const getPastEligibleEvents = async (organizerId) => {
  const now = new Date();
  const events = await Event.find({
    organizer: organizerId,
    status: { $nin: ["draft", "cancelled"] },
  })
    .select("_id title startDate endDate")
    .lean();

  return events
    .map((e) => ({ ...e, sortDate: e.endDate || e.startDate }))
    .filter((e) => e.sortDate && e.sortDate <= now)
    .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
};

const getRevenueByEvent = async (eventIds, currency) => {
  if (eventIds.length === 0) return new Map();

  const rows = await Ticket.aggregate([
    {
      $match: {
        event: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(id)) },
        ...validTicketMatch(currency),
      },
    },
    { $group: { _id: "$event", revenue: { $sum: "$price" } } },
  ]);

  return new Map(rows.map((r) => [r._id.toString(), r.revenue]));
};

// Core underwriting number: 30% of the *average* revenue across the
// organizer's most recent one or two past events (whichever are available) —
// not the sum, so a single big event doesn't inflate the limit as much as
// two consistently good ones. Computed fresh every call — never read a
// cached value when the result gates money. An admin can override the
// resulting figure per organizer (OrganizerCapitalProfile.borrowingLimitOverride);
// pass a pre-fetched `profile` via options to avoid a redundant lookup when
// the caller already has one, otherwise it's fetched here.
const calculateOrganizerCapitalMetrics = async (
  organizerId,
  currency = "ETB",
  options = {}
) => {
  const normalizedCurrency = currency === "USD" ? "USD" : "ETB";

  const [pastEvents, allEvents] = await Promise.all([
    getPastEligibleEvents(organizerId),
    Event.find({ organizer: organizerId }).select("_id").lean(),
  ]);

  const revenueByEvent = await getRevenueByEvent(
    pastEvents.map((e) => e._id),
    normalizedCurrency
  );

  const recentTwo = pastEvents.slice(0, 2).map((e) => ({
    eventId: e._id,
    eventTitle: e.title,
    eventDate: e.sortDate,
    revenue: revenueByEvent.get(e._id.toString()) || 0,
  }));

  const lastEventRevenue = recentTwo[0]?.revenue || 0;
  const lastTwoEventsRevenue = recentTwo.reduce((sum, e) => sum + e.revenue, 0);
  const averageRecentEventRevenue =
    recentTwo.length > 0
      ? Math.round((lastTwoEventsRevenue / recentTwo.length) * 100) / 100
      : 0;
  const calculatedBorrowingLimit =
    Math.round(averageRecentEventRevenue * BORROW_RATE * 100) / 100;

  const profile =
    options.profile !== undefined
      ? options.profile
      : await OrganizerCapitalProfile.findOne({ organizer: organizerId });
  const isLimitOverridden =
    !!profile && typeof profile.borrowingLimitOverride === "number";
  const borrowingLimit = isLimitOverridden
    ? profile.borrowingLimitOverride
    : calculatedBorrowingLimit;

  // Same fix as financeService: scope by event id rather than joining every
  // ticket to its event and filtering afterwards.
  const allEventIds = await getOrganizerEventIds(organizerId);
  const totalRevenueRows = allEventIds.length
    ? await Ticket.aggregate([
        { $match: organizerTicketMatch(allEventIds, normalizedCurrency) },
        { $group: { _id: null, totalRevenue: { $sum: "$price" } } },
      ])
    : [];

  return {
    currency: normalizedCurrency,
    totalEvents: allEvents.length,
    totalRevenue: totalRevenueRows[0]?.totalRevenue || 0,
    lastEventRevenue,
    lastTwoEventsRevenue,
    averageRecentEventRevenue,
    calculatedBorrowingLimit,
    borrowingLimit,
    isLimitOverridden,
    limitBasis: recentTwo,
  };
};

// The organizer's currently blocking loan, if any — pending, approved, or
// active. Mirrors the Loan.blocksNewRequests partial-unique-index guard.
const getBlockingLoan = (organizerId) =>
  Loan.findOne({ organizer: organizerId, blocksNewRequests: true });

module.exports = {
  BORROW_RATE,
  calculateOrganizerCapitalMetrics,
  getBlockingLoan,
};
