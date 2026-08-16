const { StatusCodes } = require("http-status-codes");
const Cinema = require("../models/Cinema");
const Withdrawal = require("../models/Withdrawal");
const { calculateCinemaBalance } = require("../services/cinemaFinanceService");
const { resolveCinema } = require("../utils/cinemaAccess");

// The cinema channel's money screens.
//
// Reads only. Payouts are created through the shared withdrawal endpoint
// (POST /api/withdrawals), which routes a cinema caller into
// createCinemaWithdrawal — one model, one approval queue, one place money
// leaves, exactly as Withdrawal.stream documents.

/**
 * One cinema's balance, split into its two pools.
 *
 * Serves the cinema's own finance screen (id resolved from the account) and the
 * admin view of a given cinema (id in the URL) — see resolveCinema.
 */
const getCinemaBalance = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    const balance = await calculateCinemaBalance(cinema._id, currency);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        cinema: {
          _id: cinema._id,
          name: cinema.name,
          ticketCommissionRate: cinema.ticketCommissionRate,
          beverageCommissionRate: cinema.beverageCommissionRate,
          coversCinemaVat: cinema.coversCinemaVat,
        },
        ...balance,
      },
    });
  } catch (error) {
    console.error("Error getting cinema balance:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** This cinema's payout history, both pools. */
const listCinemaWithdrawals = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { status, stream, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Scoped by `cinema`, not by the account: it is the field that identifies
    // the business, and it means this can never pick up an organizer row that
    // happens to share an account id.
    const query = { cinema: cinema._id };
    if (status && status !== "all") query.status = status;
    if (["cinema_tickets", "cinema_beverages"].includes(stream)) {
      query.stream = stream;
    }

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Withdrawal.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error listing cinema withdrawals:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Admin: every cinema's money on one screen.
 *
 * Built by walking the cinemas and asking calculateCinemaBalance for each rather
 * than by one big aggregation, so this screen and a single cinema's screen can
 * never disagree — there is one definition of a cinema's balance and both use
 * it. Cinema counts are in the tens, so the per-cinema round trip is fine; if
 * that changes this is the place to batch.
 */
const getAdminCinemaFinance = async (req, res) => {
  try {
    const currency = req.query.currency === "USD" ? "USD" : "ETB";
    const cinemas = await Cinema.find({})
      .select("name city isActive beverageEligibility")
      .sort("name")
      .lean();

    const rows = await Promise.all(
      cinemas.map(async (cinema) => {
        const balance = await calculateCinemaBalance(cinema._id, currency);
        return { cinema, ...balance };
      })
    );

    const totals = rows.reduce(
      (acc, row) => ({
        grossRevenue: acc.grossRevenue + row.combined.grossRevenue,
        cinemaRevenue: acc.cinemaRevenue + row.combined.cinemaRevenue,
        pazimoCommission: acc.pazimoCommission + row.combined.pazimoCommission,
        vatOnCommission: acc.vatOnCommission + row.combined.vatOnCommission,
        cinemaVat: acc.cinemaVat + row.combined.cinemaVat,
        pazimoCollected: acc.pazimoCollected + row.combined.pazimoCollected,
        ticketGross: acc.ticketGross + row.streams.tickets.grossRevenue,
        beverageGross: acc.beverageGross + row.streams.beverages.grossRevenue,
      }),
      {
        grossRevenue: 0,
        cinemaRevenue: 0,
        pazimoCommission: 0,
        vatOnCommission: 0,
        cinemaVat: 0,
        pazimoCollected: 0,
        ticketGross: 0,
        beverageGross: 0,
      }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: { rows, totals, currency },
    });
  } catch (error) {
    console.error("Error building admin cinema finance:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to build cinema finance summary",
      error: error.message,
    });
  }
};

module.exports = {
  getCinemaBalance,
  listCinemaWithdrawals,
  getAdminCinemaFinance,
};
