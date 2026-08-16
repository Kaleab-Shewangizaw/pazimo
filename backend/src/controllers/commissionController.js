const { StatusCodes } = require("http-status-codes");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const BeverageSale = require("../models/BeverageSale");
const {
  validTicketMatch,
  revenueAccumulators,
} = require("../utils/ticketRevenueQuery");
const {
  validBeverageSaleMatch,
  beverageRevenueAccumulators,
} = require("../utils/beverageRevenueQuery");
const {
  DEFAULT_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
  VAT_RATE,
  round2,
  toPercent,
  normalizeCommissionRate,
} = require("../config/rates");

const escapeRegExp = (v = "") => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Platform-wide money split, for the three cards on the admin tickets screen.
 *
 * All three come from one aggregation, accumulated per ticket, because
 * commission now varies per event — a single rate applied to a grand total
 * would be wrong the moment any event is not on the default.
 */
const getCommissionSummary = async (req, res) => {
  try {
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    const match = { ...validTicketMatch(currency) };
    if (req.query.from || req.query.to) {
      match.createdAt = {};
      if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) match.createdAt.$lte = new Date(req.query.to);
    }

    // Beverage sales are ETB-only today, so the USD view has a ticket stream
    // and an empty beverage one rather than a pointless scan.
    const bevMatch = { ...validBeverageSaleMatch(currency) };
    if (match.createdAt) bevMatch.soldAt = match.createdAt;

    const [[row], [bev]] = await Promise.all([
      Ticket.aggregate([
        { $match: match },
        { $group: { _id: null, ticketCount: { $sum: 1 }, ...revenueAccumulators() } },
      ]),
      currency === "ETB"
        ? BeverageSale.aggregate([
            { $match: bevMatch },
            { $group: { _id: null, salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
          ])
        : Promise.resolve([]),
    ]);

    const gross = round2(row?.grossRevenue || 0);
    const commission = round2(row?.pazimoCommission || 0);
    const vat = round2(row?.vatOnCommission || 0);

    const bevGross = round2(bev?.grossRevenue || 0);
    const bevCommission = round2(bev?.pazimoCommission || 0);
    const bevVat = round2(bev?.vatOnCommission || 0);
    const bevNet = round2(bev?.organizerRevenue || 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency,
        ticketCount: row?.ticketCount || 0,

        // The three cards show tickets + beverages together, because that is
        // the whole business. Each stream is broken out below so the split can
        // be shown alongside.
        totalCollected: round2(gross + bevGross),
        organizerNet: round2((row?.organizerRevenue || 0) + bevNet),
        pazimoCollected: round2(commission + vat + bevCommission + bevVat),
        pazimoCommission: round2(commission + bevCommission),
        vatOnCommission: round2(vat + bevVat),

        streams: {
          tickets: {
            totalCollected: gross,
            organizerNet: round2(row?.organizerRevenue || 0),
            pazimoCommission: commission,
            vatOnCommission: vat,
            pazimoCollected: round2(commission + vat),
            count: row?.ticketCount || 0,
          },
          beverages: {
            totalCollected: bevGross,
            organizerNet: bevNet,
            pazimoCommission: bevCommission,
            vatOnCommission: bevVat,
            pazimoCollected: round2(bevCommission + bevVat),
            count: bev?.salesCount || 0,
            unitsSold: bev?.unitsSold || 0,
          },
        },

        // Blended, because events sit on different rates.
        effectiveCommissionRate: gross > 0 ? commission / gross : 0,
        vatRate: VAT_RATE,
      },
    });
  } catch (error) {
    console.error("Error building commission summary:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load commission summary",
    });
  }
};

/** Events with their commission rate and what each has earned so far. */
const listEventCommissions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const search = (req.query.search || "").trim();

    const query = {};
    if (search) query.title = new RegExp(escapeRegExp(search), "i");
    if (req.query.status && req.query.status !== "all") query.status = req.query.status;

    const [events, total] = await Promise.all([
      Event.find(query)
        .select("_id title status startDate organizer commissionRate beverageCommissionRate")
        .populate("organizer", "firstName lastName email")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(query),
    ]);

    // One aggregation for the whole page rather than one per event.
    const ids = events.map((e) => e._id);
    const [rows, bevRows] = await Promise.all([
      ids.length
        ? Ticket.aggregate([
            { $match: { event: { $in: ids }, ...validTicketMatch(currency) } },
            { $group: { _id: "$event", ticketCount: { $sum: 1 }, ...revenueAccumulators() } },
          ])
        : [],
      ids.length && currency === "ETB"
        ? BeverageSale.aggregate([
            { $match: { event: { $in: ids }, ...validBeverageSaleMatch(currency) } },
            { $group: { _id: "$event", salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
          ])
        : [],
    ]);
    const byEvent = new Map(rows.map((r) => [String(r._id), r]));
    const bevByEvent = new Map(bevRows.map((r) => [String(r._id), r]));

    const data = events.map((event) => {
      const r = byEvent.get(String(event._id)) || {};
      const b = bevByEvent.get(String(event._id)) || {};
      const rate = normalizeCommissionRate(
        event.commissionRate ?? DEFAULT_COMMISSION_RATE
      );
      const bevRate = normalizeCommissionRate(
        event.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
      );
      const commission = round2(r.pazimoCommission || 0);
      const vat = round2(r.vatOnCommission || 0);
      const bevCommission = round2(b.pazimoCommission || 0);
      const bevVat = round2(b.vatOnCommission || 0);
      return {
        _id: event._id,
        title: event.title,
        status: event.status,
        startDate: event.startDate,
        organizer: event.organizer,
        commissionRate: rate,
        commissionPercent: toPercent(rate),
        // What the organizer actually loses: the rate plus VAT on it.
        totalCutPercent: toPercent(rate * (1 + VAT_RATE)),
        currency,
        ticketCount: r.ticketCount || 0,
        totalCollected: round2(r.grossRevenue || 0),
        organizerNet: round2(r.organizerRevenue || 0),
        pazimoCommission: commission,
        vatOnCommission: vat,
        pazimoCollected: round2(commission + vat),

        // Beverages, reported as their own stream with their own rate.
        beverageCommissionRate: bevRate,
        beverageCommissionPercent: toPercent(bevRate),
        beverageTotalCutPercent: toPercent(bevRate * (1 + VAT_RATE)),
        beverageSalesCount: b.salesCount || 0,
        beverageUnitsSold: b.unitsSold || 0,
        beverageCollected: round2(b.grossRevenue || 0),
        beverageOrganizerNet: round2(b.organizerRevenue || 0),
        beveragePazimoCollected: round2(bevCommission + bevVat),
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data,
      defaults: {
        defaultCommissionRate: DEFAULT_COMMISSION_RATE,
        minCommissionRate: MIN_COMMISSION_RATE,
        maxCommissionRate: MAX_COMMISSION_RATE,
        vatRate: VAT_RATE,
      },
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    console.error("Error listing event commissions:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load event commissions",
    });
  }
};

/**
 * Change an event's commission rate.
 *
 * Applies to future sales only. Tickets already sold keep the rate they were
 * sold under (Ticket.commissionRate), so this can never restate revenue that
 * has been reported or paid out — the response says so explicitly, and the UI
 * repeats it, because "why did last month's number change?" is the expensive
 * kind of surprise.
 */
const updateEventCommission = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Either rate can be sent, alone or together. Accepts 0.04 or 4 — the UI
    // sends a percentage, scripts tend to send a rate.
    const parse = (raw, label) => {
      if (raw === undefined || raw === null || raw === "") return undefined;
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`${label} must be a number`);
      const rate = n > 1 ? n / 100 : n;
      if (rate < MIN_COMMISSION_RATE || rate > MAX_COMMISSION_RATE) {
        throw new Error(
          `${label} must be between ${toPercent(MIN_COMMISSION_RATE)}% and ${toPercent(MAX_COMMISSION_RATE)}%`
        );
      }
      return rate;
    };

    let rate, beverageRate;
    try {
      rate = parse(req.body.commissionRate, "commissionRate");
      beverageRate = parse(req.body.beverageCommissionRate, "beverageCommissionRate");
    } catch (err) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: err.message });
    }

    if (rate === undefined && beverageRate === undefined) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Send commissionRate, beverageCommissionRate, or both",
      });
    }

    const event = await Event.findById(eventId)
      .select("title commissionRate beverageCommissionRate");
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found",
      });
    }

    const previous = event.commissionRate ?? DEFAULT_COMMISSION_RATE;
    const previousBeverage = event.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE;
    if (rate !== undefined) event.commissionRate = rate;
    if (beverageRate !== undefined) event.beverageCommissionRate = beverageRate;
    await event.save();

    // How many sales are already locked at the old rate — useful context for
    // whoever just made the change.
    const alreadySold = await Ticket.countDocuments({
      event: event._id,
      ...validTicketMatch(null),
    });

    const effective = event.commissionRate;
    const effectiveBeverage = event.beverageCommissionRate;

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        _id: event._id,
        title: event.title,
        previousRate: previous,
        previousBeverageRate: previousBeverage,
        commissionRate: effective,
        commissionPercent: toPercent(effective),
        totalCutPercent: toPercent(effective * (1 + VAT_RATE)),
        beverageCommissionRate: effectiveBeverage,
        beverageCommissionPercent: toPercent(effectiveBeverage),
        beverageTotalCutPercent: toPercent(effectiveBeverage * (1 + VAT_RATE)),
        appliesTo: "future sales only",
        ticketsAlreadySoldAtPreviousRate: alreadySold,
      },
    });
  } catch (error) {
    console.error("Error updating event commission:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update commission rate",
    });
  }
};

module.exports = {
  getCommissionSummary,
  listEventCommissions,
  updateEventCommission,
};
