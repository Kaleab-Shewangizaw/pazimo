const axios = require("axios");
const { StatusCodes } = require("http-status-codes");

// Chapa API v2 (api.chapa.global) uses the new scoped keys generated from the
// dashboard (CHAPA_LIVE_PRIV_... / CHAPA_TEST_PRIV_...). Those keys do NOT
// work on the v1 API or on the Link gift-card API. v2 only returns traffic
// created through v2 itself (e.g. payment links) — the historical v1
// transactions stay on the v1 endpoints.
const V2_BASE_URL = "https://api.chapa.global/v2";

const v2Client = axios.create({
  baseURL: V2_BASE_URL,
  timeout: 20000,
});

v2Client.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${process.env.CHAPA_V2_API_KEY}`;
  return config;
});

const v2ErrorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (data?.message && typeof data.message === "object") {
    return Object.values(data.message).flat().join(" ");
  }
  if (typeof data === "string") return data.slice(0, 200);
  return error.message || "Chapa v2 request failed";
};

const handleV2Error = (res, error, action) => {
  const httpStatus = error.response?.status;
  const message = v2ErrorMessage(error);
  console.error(`[CHAPA-V2] ${action} failed:`, {
    message,
    status: httpStatus,
    data: error.response?.data,
  });
  const notConfigured =
    !process.env.CHAPA_V2_API_KEY ||
    httpStatus === StatusCodes.UNAUTHORIZED ||
    httpStatus === StatusCodes.FORBIDDEN;
  res.status(httpStatus || StatusCodes.BAD_GATEWAY).json({
    status: "error",
    message,
    v2NotConfigured: notConfigured || undefined,
  });
};

// GET /api/admin/finance/chapa/v2/payments
// Passthrough filters: reference, status, currency, email, from, to, page, per_page
const getV2Payments = async (req, res) => {
  try {
    const allowed = [
      "reference",
      "status",
      "currency",
      "email",
      "from",
      "to",
      "page",
      "per_page",
    ];
    const params = {};
    for (const key of allowed) {
      if (req.query[key]) params[key] = req.query[key];
    }
    const response = await v2Client.get("/payments", { params });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || { items: [], pagination: null },
    });
  } catch (error) {
    handleV2Error(res, error, "getPayments");
  }
};

// GET /api/admin/finance/chapa/v2/payouts
const getV2Payouts = async (req, res) => {
  try {
    const params = {};
    for (const key of ["status", "page", "per_page"]) {
      if (req.query[key]) params[key] = req.query[key];
    }
    const response = await v2Client.get("/payouts", { params });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || { items: [], pagination: null },
    });
  } catch (error) {
    handleV2Error(res, error, "getPayouts");
  }
};

module.exports = {
  getV2Payments,
  getV2Payouts,
};
