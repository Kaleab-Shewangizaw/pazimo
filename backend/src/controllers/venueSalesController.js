const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Venue = require("../models/Venue");
const VenueBeverage = require("../models/VenueBeverage");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const Withdrawal = require("../models/Withdrawal");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveVenueContext } = require("./venueController");
const {
  recordSale,
  refundSale,
} = require("../services/venueBeverageSalesService");
const {
  validBeverageSaleMatch,
} = require("../utils/beverageRevenueQuery");
const {
  venueBeverageRevenueAccumulators,
} = require("../utils/venueBeverageRevenueQuery");
const {
  DEFAULT_COMMISSION_RATE,
  round2,
  toPercent,
  normalizeCommissionRate,
  totalCutPercentFor,
} = require("../config/rates");

// The venue channel's dashboards, sales recording and finance.
//
// Every query in this file reads VenueBeverageSale and scopes by `venue`. No
// figure produced here can contain an event sale, and nothing in the event-side
// controllers can see these rows — that separation is the collection boundary,
// not a filter someone has to remember to write.

// Only confirmed sales count as revenue; refunds stay in the ledger but out of
// every total.
const CONFIRMED = { status: "confirmed" };

// A dashboard with no date filter should still mean something, so an absent
// range means "everything", not "today".
const buildDateRange = (from, to) => {
  const range = {};
  if (from) {
    const parsed = new Date(from);
    if (!Number.isNaN(parsed.getTime())) range.$gte = parsed;
  }
  if (to) {
    const parsed = new Date(to);
    if (!Number.isNaN(parsed.getTime())) {
      // `to` is a day, and a day includes its own last second.
      parsed.setHours(23, 59, 59, 999);
      range.$lte = parsed;
    }
  }
  return Object.keys(range).length > 0 ? { soldAt: range } : {};
};

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

/**
 * Record a sale by hand — the counter-service path.
 *
 * Restricted to admins and the owning venue, for the same reason the event-side
 * createSale is: with no payment taken, an endpoint any signed-in customer
 * could call would let anyone mint revenue without paying. A customer checkout
 * will call venueBeverageSalesService.recordSale() server-side after the
 * payment confirms, not this route.
 */
const createVenueSale = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const { venueBeverageId, quantity, customerName, customerPhone } = req.body;
    if (!venueBeverageId) throw new BadRequestError("venueBeverageId is required");

    const sale = await recordSale({
      venueBeverageId,
      quantity,
      customerName,
      customerPhone,
      channel: "manual",
      // The line must belong to the venue this request resolved to. Without it
      // an operator could record revenue against another venue's line-up.
      venueId: venue._id,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error recording venue beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const listVenueSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, from, to } = req.query;
    const skip = (page - 1) * limit;

    // Admins may list across every venue by omitting the id; a venue account
    // can only ever reach its own, because resolveVenueContext derives it from
    // the account rather than the URL.
    let venueScope = {};
    if (req.params.venueId) {
      const venue = await resolveVenueContext(req);
      venueScope = { venue: venue._id };
    } else if (req.user.role !== "admin") {
      if (!req.venue) throw new NotFoundError("Venue not found");
      venueScope = { venue: req.venue._id };
    } else if (req.query.venueId && mongoose.Types.ObjectId.isValid(req.query.venueId)) {
      venueScope = { venue: new mongoose.Types.ObjectId(req.query.venueId) };
    }

    const query = {
      ...venueScope,
      ...buildDateRange(from, to),
      ...(status && status !== "all" ? { status } : {}),
    };

    const [sales, total] = await Promise.all([
      VenueBeverageSale.find(query)
        .sort("-soldAt")
        .skip(skip)
        .limit(Number(limit))
        .populate("venue", "name venueType city")
        .lean(),
      VenueBeverageSale.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: sales.map((sale) => ({
        ...sale,
        // Rows are merged with event sales in the admin feed, so each one
        // states its channel rather than relying on where it came from.
        salesContext: sale.salesContext || "VENUE",
      })),
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing venue beverage sales:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const refundVenueSale = async (req, res) => {
  try {
    const sale = await refundSale(req.params.id, {
      adminId: req.user.userId,
      reason: req.body.reason,
    });
    res.status(StatusCodes.OK).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error refunding venue beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Dashboards
// ---------------------------------------------------------------------------

/**
 * Everything the venue dashboards show, from one place, so the admin and venue
 * views can never disagree about the same numbers. `venueId` narrows the ledger
 * to one venue; without it the figures are platform-wide across venues.
 */
const buildVenueDashboard = async ({ venueId, from, to }) => {
  const match = {
    ...CONFIRMED,
    ...buildDateRange(from, to),
    ...(venueId ? { venue: new mongoose.Types.ObjectId(String(venueId)) } : {}),
  };

  const [totals, byBeverage, byVenue, timeline, recent] = await Promise.all([
    VenueBeverageSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          units: { $sum: "$quantity" },
          orders: { $sum: 1 },
        },
      },
    ]),

    VenueBeverageSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$beverage",
          name: { $first: "$beverageName" },
          color: { $first: "$beverageColor" },
          revenue: { $sum: "$totalAmount" },
          units: { $sum: "$quantity" },
          venues: { $addToSet: "$venue" },
        },
      },
      {
        $project: {
          name: 1,
          color: 1,
          revenue: 1,
          units: 1,
          venueCount: { $size: "$venues" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // Only meaningful platform-wide; skipped entirely for a single venue.
    venueId
      ? Promise.resolve([])
      : VenueBeverageSale.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$venue",
              revenue: { $sum: "$totalAmount" },
              units: { $sum: "$quantity" },
              drinks: { $addToSet: "$beverage" },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 50 },
          { $lookup: { from: "venues", localField: "_id", foreignField: "_id", as: "venue" } },
          {
            $project: {
              revenue: 1,
              units: 1,
              drinkCount: { $size: "$drinks" },
              name: { $ifNull: [{ $first: "$venue.name" }, "Deleted venue"] },
              venueType: { $first: "$venue.venueType" },
              city: { $first: "$venue.city" },
            },
          },
        ]),

    VenueBeverageSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$soldAt" } },
          revenue: { $sum: "$totalAmount" },
          units: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 180 },
    ]),

    VenueBeverageSale.find(match)
      .sort("-soldAt")
      .limit(12)
      .populate("venue", "name")
      .lean(),
  ]);

  // Stock is a property of the line-up, not the ledger, so it is counted
  // separately — and without the date filter, since bottles on the shelf are
  // not "sold in this range".
  const stockMatch = venueId
    ? { venue: new mongoose.Types.ObjectId(String(venueId)) }
    : {};
  const stockRows = await VenueBeverage.aggregate([
    { $match: stockMatch },
    {
      $group: {
        _id: null,
        stockTotal: { $sum: "$stockTotal" },
        sold: { $sum: "$sold" },
        listings: { $sum: 1 },
        venues: { $addToSet: "$venue" },
        potentialRevenue: { $sum: { $multiply: ["$price", "$stockTotal"] } },
      },
    },
  ]);

  const stock = stockRows[0] || {
    stockTotal: 0,
    sold: 0,
    listings: 0,
    venues: [],
    potentialRevenue: 0,
  };
  const totalsRow = totals[0] || { revenue: 0, units: 0, orders: 0 };

  return {
    totals: {
      revenue: round2(totalsRow.revenue),
      units: totalsRow.units || 0,
      orders: totalsRow.orders || 0,
      averageOrderValue: totalsRow.orders
        ? round2(totalsRow.revenue / totalsRow.orders)
        : 0,
      stockTotal: stock.stockTotal || 0,
      stockSold: stock.sold || 0,
      stockRemaining: Math.max((stock.stockTotal || 0) - (stock.sold || 0), 0),
      // Share of listed bottles actually sold. Null rather than 0 when nothing
      // is listed, so the UI can say "nothing listed" instead of implying a 0%
      // sell-through.
      sellThrough:
        stock.stockTotal > 0
          ? Math.round(((stock.sold || 0) / stock.stockTotal) * 1000) / 10
          : null,
      potentialRevenue: round2(stock.potentialRevenue),
      venuesSelling: (stock.venues || []).length,
      listings: stock.listings || 0,
    },
    byBeverage: byBeverage.map((row) => ({ ...row, revenue: round2(row.revenue) })),
    byVenue: byVenue.map((row) => ({ ...row, revenue: round2(row.revenue) })),
    timeline: timeline.map((row) => ({
      date: row._id,
      revenue: round2(row.revenue),
      units: row.units,
    })),
    recent,
  };
};

const getVenueDashboard = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const data = await buildVenueDashboard({
      venueId: venue._id,
      from: req.query.from,
      to: req.query.to,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error building venue dashboard:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const getAdminVenueDashboard = async (req, res) => {
  try {
    const data = await buildVenueDashboard({
      from: req.query.from,
      to: req.query.to,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error building admin venue dashboard:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to build the dashboard",
    });
  }
};

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

const venueWithdrawalTotals = async (venueId) => {
  const [row] = await Withdrawal.aggregate([
    {
      $match: {
        venue: new mongoose.Types.ObjectId(String(venueId)),
        stream: "venue_beverages",
      },
    },
    {
      $group: {
        _id: null,
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } },
        approved: {
          $sum: {
            $cond: [{ $in: ["$status", ["approved", "completed"]] }, "$amount", 0],
          },
        },
      },
    },
  ]);
  return { pending: round2(row?.pending || 0), approved: round2(row?.approved || 0) };
};

/** One venue's finance: totals, balance, and a per-drink split. */
const getVenueFinance = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const scope = {
      venue: new mongoose.Types.ObjectId(String(venue._id)),
      ...validBeverageSaleMatch("ETB"),
    };

    const [totalsRow, perBeverage, withdrawals] = await Promise.all([
      VenueBeverageSale.aggregate([
        { $match: scope },
        {
          $group: {
            _id: null,
            salesCount: { $sum: 1 },
            ...venueBeverageRevenueAccumulators(),
          },
        },
      ]),
      VenueBeverageSale.aggregate([
        { $match: scope },
        {
          $group: {
            _id: "$beverage",
            name: { $first: "$beverageName" },
            color: { $first: "$beverageColor" },
            salesCount: { $sum: 1 },
            ...venueBeverageRevenueAccumulators(),
          },
        },
        { $sort: { grossRevenue: -1 } },
        { $limit: 50 },
      ]),
      venueWithdrawalTotals(venue._id),
    ]);

    const t = totalsRow[0] || {};
    const venueNet = round2(t.venueRevenue || 0);
    const rate = normalizeCommissionRate(
      venue.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency: "ETB",
        venue: {
          _id: venue._id,
          name: venue.name,
          venueType: venue.venueType,
          commissionRate: rate,
          commissionPercent: toPercent(rate),
          coversVenueVat: Boolean(venue.coversVenueVat),
          totalCutPercent: totalCutPercentFor(rate, Boolean(venue.coversVenueVat)),
        },
        totals: {
          grossRevenue: round2(t.grossRevenue || 0),
          venueNet,
          pazimoCommission: round2(t.pazimoCommission || 0),
          vatOnCommission: round2(t.vatOnCommission || 0),
          venueVat: round2(t.venueVat || 0),
          pazimoCollected: round2(
            (t.pazimoCommission || 0) + (t.vatOnCommission || 0) + (t.venueVat || 0)
          ),
          unitsSold: t.unitsSold || 0,
          salesCount: t.salesCount || 0,
        },
        withdrawals: {
          pending: withdrawals.pending,
          approved: withdrawals.approved,
        },
        // The venue pool, drawn independently of every event pool on the
        // platform. Pazimo Capital does not reach it: advances are underwritten
        // against event ticket revenue, which a venue has none of.
        availableBalance: round2(venueNet - withdrawals.pending - withdrawals.approved),
        beverages: perBeverage.map((r) => ({
          beverageId: r._id,
          name: r.name,
          color: r.color,
          salesCount: r.salesCount,
          unitsSold: r.unitsSold,
          grossRevenue: round2(r.grossRevenue),
          venueNet: round2(r.venueRevenue),
          venueVat: round2(r.venueVat || 0),
          pazimoCollected: round2(
            r.pazimoCommission + r.vatOnCommission + (r.venueVat || 0)
          ),
        })),
      },
    });
  } catch (error) {
    console.error("Error building venue finance:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Platform-wide venue finance for admins, with a per-venue breakdown. */
const getAdminVenueFinance = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [totalsRow, perVenue, countRow] = await Promise.all([
      VenueBeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        {
          $group: {
            _id: null,
            salesCount: { $sum: 1 },
            ...venueBeverageRevenueAccumulators(),
          },
        },
      ]),
      VenueBeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        {
          $group: {
            _id: "$venue",
            salesCount: { $sum: 1 },
            ...venueBeverageRevenueAccumulators(),
          },
        },
        { $sort: { grossRevenue: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ]),
      VenueBeverageSale.aggregate([
        { $match: validBeverageSaleMatch("ETB") },
        { $group: { _id: "$venue" } },
        { $count: "total" },
      ]),
    ]);

    const t = totalsRow[0] || {};
    const venueIds = perVenue.map((r) => r._id);

    // Withdrawals against the venue pool, for everyone on this page.
    const wdRows = venueIds.length
      ? await Withdrawal.aggregate([
          { $match: { venue: { $in: venueIds }, stream: "venue_beverages" } },
          {
            $group: {
              _id: "$venue",
              pending: {
                $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
              },
              approved: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["approved", "completed"]] },
                    "$amount",
                    0,
                  ],
                },
              },
            },
          },
        ])
      : [];
    const wdBy = new Map(wdRows.map((r) => [String(r._id), r]));

    const venues = venueIds.length
      ? await Venue.find({ _id: { $in: venueIds } })
          .select("name venueType city beverageCommissionRate coversVenueVat")
          .lean()
      : [];
    const venueBy = new Map(venues.map((v) => [String(v._id), v]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency: "ETB",
        totals: {
          grossRevenue: round2(t.grossRevenue || 0),
          venueNet: round2(t.venueRevenue || 0),
          pazimoCommission: round2(t.pazimoCommission || 0),
          vatOnCommission: round2(t.vatOnCommission || 0),
          venueVat: round2(t.venueVat || 0),
          pazimoCollected: round2(
            (t.pazimoCommission || 0) + (t.vatOnCommission || 0) + (t.venueVat || 0)
          ),
          unitsSold: t.unitsSold || 0,
          salesCount: t.salesCount || 0,
        },
        venues: perVenue.map((r) => {
          const v = venueBy.get(String(r._id));
          const wd = wdBy.get(String(r._id)) || { pending: 0, approved: 0 };
          const net = round2(r.venueRevenue);
          const rate = normalizeCommissionRate(
            v?.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
          );
          const covered = Boolean(v?.coversVenueVat);
          return {
            venueId: r._id,
            name: v?.name || "Unknown venue",
            venueType: v?.venueType,
            city: v?.city,
            commissionRate: rate,
            commissionPercent: toPercent(rate),
            coversVenueVat: covered,
            totalCutPercent: totalCutPercentFor(rate, covered),
            salesCount: r.salesCount,
            unitsSold: r.unitsSold,
            grossRevenue: round2(r.grossRevenue),
            venueNet: net,
            venueVat: round2(r.venueVat || 0),
            pazimoCollected: round2(
              r.pazimoCommission + r.vatOnCommission + (r.venueVat || 0)
            ),
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
    console.error("Error building admin venue finance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load venue finance",
    });
  }
};

module.exports = {
  createVenueSale,
  listVenueSales,
  refundVenueSale,
  getVenueDashboard,
  getAdminVenueDashboard,
  getVenueFinance,
  getAdminVenueFinance,
};
