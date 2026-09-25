const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const Loan = require("../models/Loan");
const {
  validTicketMatch,
  revenueAccumulators,
} = require("../utils/ticketRevenueQuery");
const { round2 } = require("../config/rates");

// Everything the admin organizer list needs, in one response.
//
// The page used to assemble this in the browser: one request for the organizer
// page, then per organizer a request for their events, then per event a
// paginated loop pulling every ticket 500 at a time, then per organizer a
// balance request. Hundreds of round trips — and because tickets were fetched
// whole, it also dragged down the ~43 KB base64 QR blob attached to every one.
//
// All of that to render two numbers per row (event count, active event count)
// plus the revenue figures.
//
// This does it in five queries total, regardless of page size, and none of them
// touch ticket documents individually.

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOrganizerOverview = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const search = (req.query.search || "").trim();

    // ---- 1. the page of organizers -------------------------------------
    const query = { role: "organizer" };
    if (search) {
      const regex = new RegExp(escapeRegExp(search), "i");
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phoneNumber: regex },
      ];
    }

    const [organizers, total] = await Promise.all([
      User.find(query)
        .select("firstName lastName email phoneNumber createdAt isActive")
        .sort("-createdAt")
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    if (organizers.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: [],
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
      });
    }

    const organizerIds = organizers.map((o) => o._id);

    // ---- 2. their events (ids + status only) ----------------------------
    const events = await Event.find({ organizer: { $in: organizerIds } })
      .select("_id organizer status")
      .lean();

    const eventIdsByOrganizer = new Map();
    const counts = new Map();
    for (const e of events) {
      const key = String(e.organizer);
      if (!eventIdsByOrganizer.has(key)) {
        eventIdsByOrganizer.set(key, []);
        counts.set(key, { totalEvents: 0, activeEvents: 0 });
      }
      eventIdsByOrganizer.get(key).push(e._id);
      const c = counts.get(key);
      c.totalEvents += 1;
      if (e.status === "published") c.activeEvents += 1;
    }

    // Map every event back to its organizer so one ticket aggregation can be
    // split per organizer afterwards, instead of one aggregation each.
    const organizerByEvent = new Map(events.map((e) => [String(e._id), String(e.organizer)]));
    const allEventIds = events.map((e) => e._id);

    // ---- 3. one ticket aggregation for the whole page ------------------
    const revenueRows = allEventIds.length
      ? await Ticket.aggregate([
          { $match: { event: { $in: allEventIds }, ...validTicketMatch(currency) } },
          {
            $group: {
              _id: "$event",
              tickets: { $sum: 1 },
              ...revenueAccumulators(),
            },
          },
        ])
      : [];

    const revenueByOrganizer = new Map();
    for (const row of revenueRows) {
      const org = organizerByEvent.get(String(row._id));
      if (!org) continue;
      const acc = revenueByOrganizer.get(org) ||
        { revenue: 0, tickets: 0, commission: 0, vat: 0, organizerVat: 0, organizerShare: 0 };
      acc.revenue += row.grossRevenue;
      acc.tickets += row.tickets;
      acc.commission += row.pazimoCommission;
      acc.vat += row.vatOnCommission;
      acc.organizerVat += row.organizerVat;
      acc.organizerShare += row.organizerRevenue;
      revenueByOrganizer.set(org, acc);
    }

    // ---- 4. withdrawals, grouped in one pass ---------------------------
    //
    // Scoped to the ticket stream only — availableBalance below is a TICKET
    // balance, so a beverage or Pazimo Capital withdrawal must not be
    // subtracted from it (that was the exact "-1,346.87" bug PAZIMO_PLAN
    // decision 1 names, just for this endpoint instead of the withdrawal
    // gate). Rows written before the stream split carry no `stream` at all
    // and are ticket revenue.
    const withdrawalCurrency =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };

    const withdrawalRows = await Withdrawal.aggregate([
      {
        $match: {
          organizer: { $in: organizerIds },
          $and: [
            withdrawalCurrency,
            { $or: [{ stream: "tickets" }, { stream: { $exists: false } }] },
          ],
        },
      },
      {
        $group: {
          _id: "$organizer",
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
    const withdrawalsByOrganizer = new Map(
      withdrawalRows.map((r) => [String(r._id), r])
    );

    // ---- 5. Pazimo Capital position, one pass --------------------------
    const loanRows = await Loan.aggregate([
      {
        $match: {
          organizer: { $in: organizerIds },
          currency,
          status: { $in: ["active", "repaid"] },
        },
      },
      {
        $group: {
          _id: "$organizer",
          principalCredited: { $sum: { $ifNull: ["$approvedAmount", 0] } },
          repaidFromTickets: { $sum: { $ifNull: ["$totalRepaid", 0] } },
          outstanding: {
            $sum: {
              $cond: [
                { $eq: ["$status", "active"] },
                { $ifNull: ["$outstandingBalance", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);
    const loansByOrganizer = new Map(loanRows.map((r) => [String(r._id), r]));

    // ---- assemble ------------------------------------------------------
    const data = organizers.map((organizer) => {
      const key = String(organizer._id);
      const rev = revenueByOrganizer.get(key) ||
        { revenue: 0, tickets: 0, commission: 0, vat: 0, organizerVat: 0, organizerShare: 0 };
      const wd = withdrawalsByOrganizer.get(key) || { pending: 0, approved: 0 };
      const loan = loansByOrganizer.get(key) || {
        principalCredited: 0,
        repaidFromTickets: 0,
        outstanding: 0,
      };
      const count = counts.get(key) || { totalEvents: 0, activeEvents: 0 };

      const totalRevenue = rev.revenue;
      const organizerRevenue = rev.organizerShare;

      return {
        ...organizer,
        currency,
        totalEvents: count.totalEvents,
        activeEvents: count.activeEvents,
        totalTicketsSold: rev.tickets,
        totalRevenue: round2(totalRevenue),
        organizerRevenue: round2(organizerRevenue),
        pazimoCommission: round2(rev.commission),
        vatOnCommission: round2(rev.vat),
        // VAT withheld on this organizer's behalf, on events Pazimo covers.
        // Already excluded from organizerRevenue above; surfaced so the row can
        // show why their share is smaller than commission alone would explain.
        organizerVat: round2(rev.organizerVat),
        pazimoCollected: round2(rev.commission + rev.vat + rev.organizerVat),
        pendingWithdrawals: round2(wd.pending),
        approvedWithdrawals: round2(wd.approved),
        // Same identity financeService.calculateOrganizerBalance's
        // ticketAvailableBalance uses, so the list and the per-organizer
        // balance screen agree. Pazimo Capital's principal is its own pool
        // (see financeService's `capital` stream) and never added here —
        // only its automatic repayment (repaidFromTickets) touches this
        // figure, exactly as it touches the ticket balance everywhere else.
        availableBalance: round2(
          Math.max(0, organizerRevenue - loan.repaidFromTickets - (wd.pending + wd.approved))
        ),
        loanOutstanding: round2(loan.outstanding),
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    console.error("Error building organizer overview:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load organizer overview",
      error: error.message,
    });
  }
};

module.exports = { getOrganizerOverview };
