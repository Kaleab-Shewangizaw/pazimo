const { StatusCodes } = require("http-status-codes");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const {
  validTicketMatch,
  revenueAccumulators,
} = require("../utils/ticketRevenueQuery");
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

    const [row] = await Ticket.aggregate([
      { $match: match },
      { $group: { _id: null, ticketCount: { $sum: 1 }, ...revenueAccumulators() } },
    ]);

    const gross = round2(row?.grossRevenue || 0);
    const commission = round2(row?.pazimoCommission || 0);
    const vat = round2(row?.vatOnCommission || 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        currency,
        ticketCount: row?.ticketCount || 0,

        // Card 1 — everything collected from buyers, before anything is taken.
        totalCollected: gross,

        // Card 2 — what the organizers keep once commission and VAT are out.
        organizerNet: round2(row?.organizerRevenue || 0),

        // Card 3 — Pazimo's side: commission plus the VAT charged on it.
        pazimoCollected: round2(commission + vat),
        pazimoCommission: commission,
        vatOnCommission: vat,

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
        .select("_id title status startDate organizer commissionRate")
        .populate("organizer", "firstName lastName email")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Event.countDocuments(query),
    ]);

    // One aggregation for the whole page rather than one per event.
    const ids = events.map((e) => e._id);
    const rows = ids.length
      ? await Ticket.aggregate([
          { $match: { event: { $in: ids }, ...validTicketMatch(currency) } },
          { $group: { _id: "$event", ticketCount: { $sum: 1 }, ...revenueAccumulators() } },
        ])
      : [];
    const byEvent = new Map(rows.map((r) => [String(r._id), r]));

    const data = events.map((event) => {
      const r = byEvent.get(String(event._id)) || {};
      const rate = normalizeCommissionRate(
        event.commissionRate ?? DEFAULT_COMMISSION_RATE
      );
      const commission = round2(r.pazimoCommission || 0);
      const vat = round2(r.vatOnCommission || 0);
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
    const raw = req.body.commissionRate;

    // Accept either 0.04 or 4 — the UI sends a percentage, scripts send a rate.
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "commissionRate must be a number",
      });
    }
    const rate = asNumber > 1 ? asNumber / 100 : asNumber;

    if (rate < MIN_COMMISSION_RATE || rate > MAX_COMMISSION_RATE) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `commissionRate must be between ${toPercent(MIN_COMMISSION_RATE)}% and ${toPercent(MAX_COMMISSION_RATE)}%`,
      });
    }

    const event = await Event.findById(eventId).select("title commissionRate");
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found",
      });
    }

    const previous = event.commissionRate ?? DEFAULT_COMMISSION_RATE;
    event.commissionRate = rate;
    await event.save();

    // How many sales are already locked at the old rate — useful context for
    // whoever just made the change.
    const alreadySold = await Ticket.countDocuments({
      event: event._id,
      ...validTicketMatch(null),
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        _id: event._id,
        title: event.title,
        previousRate: previous,
        commissionRate: rate,
        commissionPercent: toPercent(rate),
        totalCutPercent: toPercent(rate * (1 + VAT_RATE)),
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
