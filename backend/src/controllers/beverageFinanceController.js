const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Event = require("../models/Event");
const BeverageSale = require("../models/BeverageSale");
const EventBeverage = require("../models/EventBeverage");
const Withdrawal = require("../models/Withdrawal");
const {
  validBeverageSaleMatch,
  beverageRevenueAccumulators,
} = require("../utils/beverageRevenueQuery");
const {
  DEFAULT_COMMISSION_RATE,
  VAT_RATE,
  round2,
  toPercent,
  normalizeCommissionRate,
} = require("../config/rates");

// The beverage side of the business, as its own dashboard.
//
// Bar revenue is a separate pool from ticket revenue: separate balance,
// separate withdrawal request, separate screen. What it is NOT is a separate
// money system — it shares the Withdrawal model, the approval flow and the
// commission engine, so there is still exactly one place money leaves.

const streamMatch = (organizerId) => ({
  organizer: new mongoose.Types.ObjectId(organizerId),
  ...validBeverageSaleMatch("ETB"),
});

const beverageWithdrawalTotals = async (organizerId) => {
  const [row] = await Withdrawal.aggregate([
    { $match: { organizer: new mongoose.Types.ObjectId(organizerId), stream: "beverages" } },
    {
      $group: {
        _id: null,
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } },
        approved: {
          $sum: { $cond: [{ $in: ["$status", ["approved", "completed"]] }, "$amount", 0] },
        },
      },
    },
  ]);
  return { pending: round2(row?.pending || 0), approved: round2(row?.approved || 0) };
};

/** One organizer's beverage dashboard: totals, balance, and a per-event split. */
const getOrganizerBeverageFinance = async (req, res) => {
  try {
    const organizerId =
      req.user.role === "organizer" || req.user.role === "cinema"
        ? req.user.userId
        : req.params.organizerId;

    const [totalsRow, perEvent, withdrawals] = await Promise.all([
      BeverageSale.aggregate([
        { $match: streamMatch(organizerId) },
        { $group: { _id: null, salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
      ]),
      BeverageSale.aggregate([
        { $match: streamMatch(organizerId) },
        { $group: { _id: "$event", salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
        { $sort: { grossRevenue: -1 } },
        { $limit: 50 },
      ]),
      beverageWithdrawalTotals(organizerId),
    ]);

    const t = totalsRow[0] || {};
    const organizerNet = round2(t.organizerRevenue || 0);

    // Fill in event titles and each event's bar rate in one lookup.
    const eventIds = perEvent.map((r) => r._id);
    const events = eventIds.length
      ? await Event.find({ _id: { $in: eventIds } })
          .select("_id title startDate beverageCommissionRate")
          .lean()
      : [];
    const byId = new Map(events.map((e) => [String(e._id), e]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency: "ETB",
        totals: {
          grossRevenue: round2(t.grossRevenue || 0),
          organizerNet,
          pazimoCommission: round2(t.pazimoCommission || 0),
          vatOnCommission: round2(t.vatOnCommission || 0),
          pazimoCollected: round2((t.pazimoCommission || 0) + (t.vatOnCommission || 0)),
          unitsSold: t.unitsSold || 0,
          salesCount: t.salesCount || 0,
        },
        withdrawals: {
          pending: withdrawals.pending,
          approved: withdrawals.approved,
        },
        // The beverage pool, drawn independently of ticket revenue. Pazimo
        // Capital does not touch this side — advances are underwritten against
        // event revenue and repaid from ticket sales only.
        availableBalance: round2(organizerNet - withdrawals.pending - withdrawals.approved),
        events: perEvent.map((r) => {
          const event = byId.get(String(r._id));
          const rate = normalizeCommissionRate(
            event?.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
          );
          return {
            eventId: r._id,
            title: event?.title || "Unknown event",
            startDate: event?.startDate,
            commissionRate: rate,
            commissionPercent: toPercent(rate),
            totalCutPercent: toPercent(rate * (1 + VAT_RATE)),
            salesCount: r.salesCount,
            unitsSold: r.unitsSold,
            grossRevenue: round2(r.grossRevenue),
            organizerNet: round2(r.organizerRevenue),
            pazimoCollected: round2(r.pazimoCommission + r.vatOnCommission),
          };
        }),
      },
    });
  } catch (error) {
    console.error("Error building organizer beverage finance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load beverage finance",
    });
  }
};

/** Platform-wide beverage dashboard for admins, with a per-organizer breakdown. */
const getAdminBeverageFinance = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [totalsRow, perOrganizer, countRow] = await Promise.all([
      BeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        { $group: { _id: null, salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
      ]),
      BeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        { $group: { _id: "$organizer", salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
        { $sort: { grossRevenue: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      BeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        { $group: { _id: "$organizer" } },
        { $count: "total" },
      ]),
    ]);

    const t = totalsRow[0] || {};
    const organizerIds = perOrganizer.map((r) => r._id);

    // Withdrawals against the beverage pool, for everyone on this page.
    const wdRows = organizerIds.length
      ? await Withdrawal.aggregate([
          { $match: { organizer: { $in: organizerIds }, stream: "beverages" } },
          {
            $group: {
              _id: "$organizer",
              pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } },
              approved: {
                $sum: { $cond: [{ $in: ["$status", ["approved", "completed"]] }, "$amount", 0] },
              },
            },
          },
        ])
      : [];
    const wdBy = new Map(wdRows.map((r) => [String(r._id), r]));

    const users = organizerIds.length
      ? await User.find({ _id: { $in: organizerIds } })
          .select("firstName lastName email")
          .lean()
      : [];
    const userBy = new Map(users.map((u) => [String(u._id), u]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency: "ETB",
        totals: {
          grossRevenue: round2(t.grossRevenue || 0),
          organizerNet: round2(t.organizerRevenue || 0),
          pazimoCommission: round2(t.pazimoCommission || 0),
          vatOnCommission: round2(t.vatOnCommission || 0),
          pazimoCollected: round2((t.pazimoCommission || 0) + (t.vatOnCommission || 0)),
          unitsSold: t.unitsSold || 0,
          salesCount: t.salesCount || 0,
        },
        organizers: perOrganizer.map((r) => {
          const u = userBy.get(String(r._id));
          const wd = wdBy.get(String(r._id)) || { pending: 0, approved: 0 };
          const net = round2(r.organizerRevenue);
          return {
            organizerId: r._id,
            name: u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "Unknown",
            email: u?.email,
            salesCount: r.salesCount,
            unitsSold: r.unitsSold,
            grossRevenue: round2(r.grossRevenue),
            organizerNet: net,
            pazimoCollected: round2(r.pazimoCommission + r.vatOnCommission),
            pendingWithdrawals: round2(wd.pending),
            approvedWithdrawals: round2(wd.approved),
            availableBalance: round2(net - wd.pending - wd.approved),
          };
        }),
      },
      pagination: {
        total: countRow[0]?.total || 0,
        page,
        pages: Math.ceil((countRow[0]?.total || 0) / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("Error building admin beverage finance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load beverage finance",
    });
  }
};

/**
 * Events that have a beverage line-up, with what each has taken at the bar and
 * the commission rate it runs at.
 *
 * The beverage twin of the ticket commission table: an admin scans the list,
 * sees the sales, and edits the rate inline via
 * PATCH /api/admin/commission/events/:eventId { beverageCommissionRate }.
 */
const listBeverageEvents = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || "").trim();

    // Only events that actually offer drinks — an event with no line-up has no
    // beverage rate worth showing.
    const eventIds = await EventBeverage.distinct("event");
    if (eventIds.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        pagination: { total: 0, page, pages: 0, limit },
      });
    }

    const query = { _id: { $in: eventIds } };
    if (search) query.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const [events, total] = await Promise.all([
      Event.find(query)
        .select("_id title status startDate organizer beverageCommissionRate")
        .populate("organizer", "firstName lastName email")
        .sort("-startDate")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(query),
    ]);

    const pageIds = events.map((e) => e._id);

    // Sales and line-up size, one aggregation each for the whole page.
    const [salesRows, lineupRows] = await Promise.all([
      BeverageSale.aggregate([
        { $match: { event: { $in: pageIds }, ...validBeverageSaleMatch("ETB") } },
        { $group: { _id: "$event", salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
      ]),
      EventBeverage.aggregate([
        { $match: { event: { $in: pageIds } } },
        {
          $group: {
            _id: "$event",
            drinksOffered: { $sum: 1 },
            stockTotal: { $sum: "$stockTotal" },
            sold: { $sum: "$sold" },
          },
        },
      ]),
    ]);
    const salesBy = new Map(salesRows.map((r) => [String(r._id), r]));
    const lineupBy = new Map(lineupRows.map((r) => [String(r._id), r]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: events.map((event) => {
        const r = salesBy.get(String(event._id)) || {};
        const l = lineupBy.get(String(event._id)) || {};
        const rate = normalizeCommissionRate(
          event.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
        );
        return {
          _id: event._id,
          title: event.title,
          status: event.status,
          startDate: event.startDate,
          organizer: event.organizer,
          commissionRate: rate,
          commissionPercent: toPercent(rate),
          totalCutPercent: toPercent(rate * (1 + VAT_RATE)),
          drinksOffered: l.drinksOffered || 0,
          stockTotal: l.stockTotal || 0,
          stockSold: l.sold || 0,
          stockRemaining: Math.max((l.stockTotal || 0) - (l.sold || 0), 0),
          salesCount: r.salesCount || 0,
          unitsSold: r.unitsSold || 0,
          totalCollected: round2(r.grossRevenue || 0),
          organizerNet: round2(r.organizerRevenue || 0),
          pazimoCollected: round2((r.pazimoCommission || 0) + (r.vatOnCommission || 0)),
        };
      }),
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    console.error("Error listing beverage events:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load beverage events",
    });
  }
};

module.exports = {
  getOrganizerBeverageFinance,
  getAdminBeverageFinance,
  listBeverageEvents,
};
