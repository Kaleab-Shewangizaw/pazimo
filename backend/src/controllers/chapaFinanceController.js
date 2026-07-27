const axios = require("axios");
const { StatusCodes } = require("http-status-codes");
const Payment = require("../models/Payment");

const CHAPA_BASE_URL = "https://api.chapa.co/v1";

const chapaClient = axios.create({
  baseURL: CHAPA_BASE_URL,
  timeout: 20000,
});

chapaClient.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.CHAPA_SECRET_KEY}`;
  return config;
});

// Chapa's `message` is sometimes a validation-error object, not a string
const chapaErrorMessage = (error) => {
  const message = error.response?.data?.message;
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    return Object.values(message).flat().join(" ");
  }
  if (typeof error.response?.data === "string") return error.response.data;
  return error.message || "Chapa request failed";
};

const handleChapaError = (res, error, action) => {
  console.error(`[CHAPA-FINANCE] ${action} failed:`, {
    message: chapaErrorMessage(error),
    status: error.response?.status,
    data: error.response?.data,
  });
  res.status(error.response?.status || StatusCodes.BAD_GATEWAY).json({
    status: "error",
    message: chapaErrorMessage(error),
  });
};

// Chapa has returned transactions both as a bare array and nested under
// data.transactions depending on account/version — normalize both shapes.
const extractTransactions = (payload) => {
  const data = payload?.data;
  if (Array.isArray(data)) return { transactions: data, pagination: null };
  if (Array.isArray(data?.transactions)) {
    return {
      transactions: data.transactions,
      pagination: data.pagination || data.meta || null,
    };
  }
  return { transactions: [], pagination: null };
};

// GET /api/admin/finance/chapa/balances
const getChapaBalances = async (req, res) => {
  try {
    const response = await chapaClient.get("/balances");
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || [],
    });
  } catch (error) {
    handleChapaError(res, error, "getBalances");
  }
};

// GET /api/admin/finance/chapa/transactions
// Query params passed through to Chapa: page, per_page, from_date, to_date, currency, status
const getChapaTransactions = async (req, res) => {
  try {
    const { page, per_page, from_date, to_date, currency, status } = req.query;
    const params = {};
    if (page) params.page = page;
    if (per_page) params.per_page = per_page;
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    // Chapa rejects uppercase filter values ("currency must be one of: etb, usd.")
    if (currency) params.currency = String(currency).toLowerCase();
    if (status) params.status = String(status).toLowerCase();

    const response = await chapaClient.get("/transactions", { params });
    const { transactions, pagination } = extractTransactions(response.data);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: { transactions, pagination },
    });
  } catch (error) {
    handleChapaError(res, error, "getTransactions");
  }
};

// GET /api/admin/finance/chapa/transactions/:ref/events
const getChapaTransactionEvents = async (req, res) => {
  try {
    const response = await chapaClient.get(
      `/transaction/events/${encodeURIComponent(req.params.ref)}`
    );
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || [],
    });
  } catch (error) {
    handleChapaError(res, error, "getTransactionEvents");
  }
};

// GET /api/admin/finance/chapa/summary?from_date=&to_date=
// Aggregates Chapa transactions for the period (defaults to last 30 days)
// and compares them against local Payment records for the same window.
const getChapaSummary = async (req, res) => {
  try {
    const toDate = req.query.to_date
      ? new Date(req.query.to_date)
      : new Date();
    const fromDate = req.query.from_date
      ? new Date(req.query.from_date)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const fmt = (d) => d.toISOString().slice(0, 10);

    // Pull transactions in parallel batches of pages. Chapa caps per_page at 100
    // and doesn't return a total count, so we fetch until a short page shows up.
    // MAX_PAGES caps the work so a huge history can't hang the request.
    const MAX_PAGES = 30;
    const PER_PAGE = 100;
    const BATCH_SIZE = 5;
    let allTransactions = [];
    let sawLastPage = false;
    let nextPage = 1;
    while (!sawLastPage && nextPage <= MAX_PAGES) {
      const pages = [];
      for (let i = 0; i < BATCH_SIZE && nextPage + i <= MAX_PAGES; i++) {
        pages.push(nextPage + i);
      }
      const responses = await Promise.all(
        pages.map((page) =>
          chapaClient.get("/transactions", {
            params: {
              from_date: fmt(fromDate),
              to_date: fmt(toDate),
              page,
              per_page: PER_PAGE,
            },
          })
        )
      );
      for (const response of responses) {
        const { transactions } = extractTransactions(response.data);
        allTransactions = allTransactions.concat(transactions);
        if (transactions.length < PER_PAGE) sawLastPage = true;
      }
      nextPage += pages.length;
    }
    const truncated = !sawLastPage;

    const summary = {
      period: { from: fmt(fromDate), to: fmt(toDate) },
      truncated,
      totalCount: allTransactions.length,
      byStatus: {},
      byCurrency: {},
      daily: {},
    };

    for (const tx of allTransactions) {
      const status = (tx.status || "unknown").toLowerCase();
      const currency = tx.currency || "ETB";
      const amount = parseFloat(tx.amount) || 0;
      const charge = parseFloat(tx.charge) || 0;
      const day = (tx.created_at || tx.createdAt || "").slice(0, 10);

      summary.byStatus[status] = summary.byStatus[status] || {
        count: 0,
        amount: 0,
      };
      summary.byStatus[status].count += 1;
      summary.byStatus[status].amount += amount;

      if (status === "success") {
        summary.byCurrency[currency] = summary.byCurrency[currency] || {
          count: 0,
          amount: 0,
          charges: 0,
        };
        summary.byCurrency[currency].count += 1;
        summary.byCurrency[currency].amount += amount;
        summary.byCurrency[currency].charges += charge;

        if (day) {
          summary.daily[day] = summary.daily[day] || {};
          summary.daily[day][currency] =
            (summary.daily[day][currency] || 0) + amount;
        }
      }
    }

    // Local Chapa payment records over the same window, for reconciliation
    const localCounts = await Payment.aggregate([
      {
        $match: {
          provider: "chapa",
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ]);

    const local = {};
    for (const row of localCounts) {
      local[(row._id || "unknown").toLowerCase()] = {
        count: row.count,
        amount: row.amount,
      };
    }

    res.status(StatusCodes.OK).json({
      status: "success",
      data: { chapa: summary, local },
    });
  } catch (error) {
    if (error.response) {
      return handleChapaError(res, error, "getSummary");
    }
    console.error("[CHAPA-FINANCE] getSummary failed:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: error.message || "Failed to build Chapa summary",
    });
  }
};

module.exports = {
  getChapaBalances,
  getChapaTransactions,
  getChapaTransactionEvents,
  getChapaSummary,
};
