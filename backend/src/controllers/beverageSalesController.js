const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Event = require("../models/Event");
const EventBeverage = require("../models/EventBeverage");
const BeverageSale = require("../models/BeverageSale");
const UsherEventAccess = require("../models/UsherEventAccess");
const CashierEventAccess = require("../models/CashierEventAccess");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");
const {
  recordSale,
  refundSale,
  redeemSale,
  listSalesByReference,
  computeEventEndsAt,
  REDEEM_GRACE_HOURS_AFTER_EVENT,
} = require("../services/beverageSalesService");

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

const round2 = (value) => Math.round((value || 0) * 100) / 100;

// Everything the dashboards show, from one place, so the admin and organizer
// views can never disagree about the same numbers. `scope` narrows the ledger
// to one organizer; without it the figures are platform-wide.
const buildDashboard = async ({ organizerId, from, to }) => {
  const match = {
    ...CONFIRMED,
    ...buildDateRange(from, to),
    ...(organizerId ? { organizer: new mongoose.Types.ObjectId(organizerId) } : {}),
  };

  const [totals, byBeverage, byEvent, byOrganizer, timeline, recent] = await Promise.all([
    BeverageSale.aggregate([
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

    BeverageSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$beverage",
          name: { $first: "$beverageName" },
          color: { $first: "$beverageColor" },
          revenue: { $sum: "$totalAmount" },
          units: { $sum: "$quantity" },
          events: { $addToSet: "$event" },
        },
      },
      {
        $project: {
          name: 1,
          color: 1,
          revenue: 1,
          units: 1,
          eventCount: { $size: "$events" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    BeverageSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$event",
          revenue: { $sum: "$totalAmount" },
          units: { $sum: "$quantity" },
          drinks: { $addToSet: "$beverage" },
          organizer: { $first: "$organizer" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 50 },
      { $lookup: { from: "events", localField: "_id", foreignField: "_id", as: "event" } },
      { $lookup: { from: "users", localField: "organizer", foreignField: "_id", as: "organizerDoc" } },
      {
        $project: {
          revenue: 1,
          units: 1,
          drinkCount: { $size: "$drinks" },
          title: { $ifNull: [{ $first: "$event.title" }, "Deleted event"] },
          startDate: { $first: "$event.startDate" },
          organizerName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: [{ $first: "$organizerDoc.firstName" }, ""] },
                  " ",
                  { $ifNull: [{ $first: "$organizerDoc.lastName" }, ""] },
                ],
              },
            },
          },
        },
      },
    ]),

    // Only meaningful platform-wide; skipped entirely for a single organizer.
    organizerId
      ? Promise.resolve([])
      : BeverageSale.aggregate([
          { $match: match },
          {
            $group: {
              _id: "$organizer",
              revenue: { $sum: "$totalAmount" },
              units: { $sum: "$quantity" },
              events: { $addToSet: "$event" },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 20 },
          { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "organizer" } },
          {
            $project: {
              revenue: 1,
              units: 1,
              eventCount: { $size: "$events" },
              name: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: [{ $first: "$organizer.firstName" }, ""] },
                      " ",
                      { $ifNull: [{ $first: "$organizer.lastName" }, ""] },
                    ],
                  },
                },
              },
              email: { $first: "$organizer.email" },
            },
          },
        ]),

    BeverageSale.aggregate([
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

    BeverageSale.find(match)
      .sort("-soldAt")
      .limit(12)
      .populate("event", "title")
      .lean(),
  ]);

  // Stock is a property of the line-up, not the ledger, so it is counted
  // separately — and without the date filter, since bottles listed for a future
  // event are not "sold in this range".
  const stockMatch = organizerId
    ? { organizer: new mongoose.Types.ObjectId(organizerId) }
    : {};
  const stockRows = await EventBeverage.aggregate([
    { $match: stockMatch },
    {
      $group: {
        _id: null,
        stockTotal: { $sum: "$stockTotal" },
        sold: { $sum: "$sold" },
        listings: { $sum: 1 },
        events: { $addToSet: "$event" },
        potentialRevenue: { $sum: { $multiply: ["$price", "$stockTotal"] } },
      },
    },
  ]);

  const stock = stockRows[0] || {
    stockTotal: 0,
    sold: 0,
    listings: 0,
    events: [],
    potentialRevenue: 0,
  };
  const totalsRow = totals[0] || { revenue: 0, units: 0, orders: 0 };

  return {
    totals: {
      revenue: round2(totalsRow.revenue),
      units: totalsRow.units || 0,
      orders: totalsRow.orders || 0,
      averageOrderValue: totalsRow.orders ? round2(totalsRow.revenue / totalsRow.orders) : 0,
      stockTotal: stock.stockTotal || 0,
      stockSold: stock.sold || 0,
      stockRemaining: Math.max((stock.stockTotal || 0) - (stock.sold || 0), 0),
      // Share of listed bottles actually sold. Undefined rather than 0 when
      // nothing is listed, so the UI can say "nothing listed" instead of
      // implying a 0% sell-through.
      sellThrough:
        stock.stockTotal > 0 ? Math.round(((stock.sold || 0) / stock.stockTotal) * 1000) / 10 : null,
      potentialRevenue: round2(stock.potentialRevenue),
      eventsSelling: (stock.events || []).length,
      listings: stock.listings || 0,
    },
    byBeverage: byBeverage.map((row) => ({ ...row, revenue: round2(row.revenue) })),
    byEvent: byEvent.map((row) => ({ ...row, revenue: round2(row.revenue) })),
    byOrganizer: byOrganizer.map((row) => ({ ...row, revenue: round2(row.revenue) })),
    timeline: timeline.map((row) => ({
      date: row._id,
      revenue: round2(row.revenue),
      units: row.units,
    })),
    recent,
  };
};

const getAdminDashboard = async (req, res) => {
  try {
    const data = await buildDashboard({ from: req.query.from, to: req.query.to });
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error building admin beverage dashboard:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to build the dashboard",
    });
  }
};

const getOrganizerDashboard = async (req, res) => {
  try {
    const data = await buildDashboard({
      organizerId: req.user.userId,
      from: req.query.from,
      to: req.query.to,
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error building organizer beverage dashboard:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to build the dashboard",
    });
  }
};

// Per-event breakdown, used by both surfaces. Organizers only ever see their
// own event; admins see any.
const getEventSalesBreakdown = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) throw new NotFoundError("Event not found");

    const query =
      req.user.role === "admin"
        ? { _id: eventId }
        : { _id: eventId, organizer: req.user.userId };
    const event = await Event.findOne(query).select("_id title startDate");
    if (!event) throw new NotFoundError("Event not found");

    const [lines, sales] = await Promise.all([
      EventBeverage.find({ event: event._id })
        .populate("beverage", "name image color isActive")
        .lean(),
      BeverageSale.aggregate([
        { $match: { ...CONFIRMED, event: new mongoose.Types.ObjectId(eventId) } },
        {
          $group: {
            _id: "$eventBeverage",
            revenue: { $sum: "$totalAmount" },
            units: { $sum: "$quantity" },
            orders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const salesByLine = new Map(sales.map((row) => [row._id.toString(), row]));
    const data = lines.map((line) => {
      const row = salesByLine.get(line._id.toString());
      return {
        ...line,
        remaining: Math.max((line.stockTotal || 0) - (line.sold || 0), 0),
        revenue: round2(row?.revenue),
        units: row?.units || 0,
        orders: row?.orders || 0,
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      event,
      data,
      totals: {
        revenue: round2(data.reduce((sum, row) => sum + row.revenue, 0)),
        units: data.reduce((sum, row) => sum + row.units, 0),
        stockTotal: data.reduce((sum, row) => sum + (row.stockTotal || 0), 0),
        stockRemaining: data.reduce((sum, row) => sum + row.remaining, 0),
      },
    });
  } catch (error) {
    console.error("Error building event sales breakdown:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Records a sale by hand.
//
// Deliberately restricted to admins and the owning organizer while there is no
// payment flow: an endpoint any signed-in customer could call would let anyone
// mint revenue without paying. When checkout lands it will call
// beverageSalesService.recordSale() directly, server-side, after the payment is
// confirmed — not this route.
const createSale = async (req, res) => {
  try {
    const { eventBeverageId, quantity, customerName, customerPhone } = req.body;
    if (!eventBeverageId) throw new BadRequestError("eventBeverageId is required");

    const line = await EventBeverage.findById(eventBeverageId).select("organizer");
    if (!line) throw new NotFoundError("That drink is not on this event");

    if (req.user.role !== "admin" && line.organizer.toString() !== req.user.userId) {
      throw new ForbiddenError("You can only record sales for your own events");
    }

    const sale = await recordSale({
      eventBeverageId,
      quantity,
      customerName,
      customerPhone,
      channel: "manual",
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error recording beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const listSales = async (req, res) => {
  try {
    const { page = 1, limit = 20, eventId, status, from, to } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      ...buildDateRange(from, to),
      ...(status && status !== "all" ? { status } : {}),
      ...(eventId && mongoose.Types.ObjectId.isValid(eventId) ? { event: eventId } : {}),
      ...(req.user.role === "admin" ? {} : { organizer: req.user.userId }),
    };

    const [sales, total] = await Promise.all([
      BeverageSale.find(query)
        .sort("-soldAt")
        .skip(skip)
        .limit(Number(limit))
        .populate("event", "title")
        .populate("organizer", "firstName lastName email")
        .lean(),
      BeverageSale.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: sales,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing beverage sales:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list sales",
    });
  }
};

const refund = async (req, res) => {
  try {
    const sale = await refundSale(req.params.id, {
      adminId: req.user.userId,
      reason: req.body.reason,
    });
    res.status(StatusCodes.OK).json({ success: true, data: sale });
  } catch (error) {
    console.error("Error refunding beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Collecting a pre-bought drink at the door.
//
// Same authorization shape as ticketController.js's validateQRCode/
// checkInTicket: admins and partners pass straight through, and an usher or
// a cashier must hold a live event grant for it (UsherEventAccess /
// CashierEventAccess respectively). An organizer no longer redeems its own
// event's drinks directly — it runs the event, it doesn't work the bar; that
// job now belongs to a "cashier" account scoped to the event via a redeemed
// EventCashierCode (see eventCashierController.js), same as an usher scans
// tickets rather than the organizer itself. Shared by both the read-only
// lookup below and the actual redeem, so the two can never disagree about
// who's allowed to act on a given event's drinks.
const assertCanActOnEventDrinks = async (req, eventId) => {
  const requesterId = req.user?.userId || req.user?._id;

  if (req.user.role === "usher") {
    const hasAccess = await UsherEventAccess.exists({
      usher: requesterId,
      event: eventId,
      revokedAt: null,
    });
    if (!hasAccess) throw new ForbiddenError("You don't have access to this event");
  } else if (req.user.role === "cashier") {
    const hasAccess = await CashierEventAccess.exists({
      cashier: requesterId,
      event: eventId,
      revokedAt: null,
    });
    if (!hasAccess) throw new ForbiddenError("You don't have access to this event");
  }
  // admin and partner pass straight through — see restrictTo on both routes.

  return requesterId;
};

const redeemBeverageSale = async (req, res) => {
  try {
    const { saleId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(saleId)) {
      throw new NotFoundError("That drink is not on this order");
    }

    const sale = await BeverageSale.findById(saleId).select("event");
    if (!sale) throw new NotFoundError("That drink is not on this order");

    const requesterId = await assertCanActOnEventDrinks(req, sale.event);

    const redeemed = await redeemSale({
      saleId,
      eventId: sale.event,
      redeemedBy: requesterId,
    });

    res.status(StatusCodes.OK).json({ success: true, data: redeemed });
  } catch (error) {
    console.error("Error redeeming beverage sale:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/beverages/sales/outstanding/:reference — what a door scanner
 * shows BEFORE handing anything over. `reference` is the human-facing
 * pickup code printed as a barcode (BeverageSale.referenceNumber) — the
 * event-side twin of cinemaBeverageController's listOutstandingForOrder and
 * venueSalesController's getOutstandingVenueOrder.
 *
 * Read-only: never throws for an already-collected or refunded item, it
 * returns what's still outstanding (possibly empty) so the scanner can show
 * that instead of a bare error — same reasoning as the cinema/venue lookups.
 */
const getOutstandingByReference = async (req, res) => {
  try {
    const sales = await listSalesByReference({ referenceNumber: req.params.reference });
    if (!sales.length) throw new NotFoundError("That order could not be found");

    // Every sale under one reference is one order, hence one event.
    await assertCanActOnEventDrinks(req, sales[0].event);

    const event = await Event.findById(sales[0].event).select(
      "startDate endDate startTime endTime"
    );
    const eventEndsAt = computeEventEndsAt(event);
    const isExpired = !!(
      eventEndsAt &&
      new Date() > new Date(eventEndsAt.getTime() + REDEEM_GRACE_HOURS_AFTER_EVENT * 60 * 60 * 1000)
    );

    const outstanding = sales.filter(
      (s) =>
        s.channel === "online" &&
        s.status === "confirmed" &&
        !s.redeemedAt &&
        !s.pendingShare
    );

    res.status(StatusCodes.OK).json({ success: true, data: outstanding, isExpired });
  } catch (error) {
    console.error("Error reading beverage order for staff:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdminDashboard,
  getOrganizerDashboard,
  getEventSalesBreakdown,
  createSale,
  listSales,
  refund,
  redeemBeverageSale,
  getOutstandingByReference,
};
