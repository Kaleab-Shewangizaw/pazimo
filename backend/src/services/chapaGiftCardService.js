const axios = require("axios");

// Chapa Link (gift cards) is a separate product from the main payment API.
// It needs its own API key — the regular CHAPA_SECRET_KEY is rejected by
// api.chapa.link until Link is activated for the merchant account.
const LINK_BASE_URL = "https://api.chapa.link";

const linkClient = axios.create({
  baseURL: LINK_BASE_URL,
  timeout: 20000,
});

linkClient.interceptors.request.use((config) => {
  const key = process.env.CHAPA_LINK_API_KEY || process.env.CHAPA_SECRET_KEY;
  config.headers.Authorization = `Bearer ${key}`;
  return config;
});

const linkErrorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data?.message === "string") return data.message;
  if (data?.message && typeof data.message === "object") {
    return Object.values(data.message).flat().join(" ");
  }
  if (typeof data?.error === "string") return data.error;
  if (typeof data === "string") return data;
  return error.message || "Chapa Link request failed";
};

// The Link API answers with "Unauthorized ..." when the merchant account has
// no Link key yet — callers use this to surface a distinct "not activated"
// state instead of a generic error.
const isLinkNotActivated = (error) => {
  const httpStatus = error.response?.status;
  const message = linkErrorMessage(error);
  return httpStatus === 401 || httpStatus === 403 || /unauthorized/i.test(message);
};

const getCard = async (cardNumber) => {
  const response = await linkClient.get(`/card/${encodeURIComponent(cardNumber)}`);
  return response.data?.data;
};

// type: "hosted" -> { checkout_url, link_reference, ... }
const topUpHosted = async ({ card_number, amount, merchant_reference }) => {
  const payload = { type: "hosted", amount, card_number };
  if (merchant_reference) payload.merchant_reference = merchant_reference;
  const response = await linkClient.post("/card/payments", payload);
  return response.data?.data;
};

// type: "direct-charge" -> { link_reference, payment_status, auth_type, ... }
const topUpDirectCharge = async ({
  card_number,
  amount,
  phone_number,
  payment_method,
  merchant_reference,
}) => {
  const payload = {
    type: "direct-charge",
    amount,
    card_number,
    phone_number,
    payment_method,
  };
  if (merchant_reference) payload.merchant_reference = merchant_reference;
  const response = await linkClient.post("/card/payments", payload);
  return response.data?.data;
};

// GET /card/payment/{reference}/status -> { status, amount, currency, ... }
const getPaymentStatus = async (reference) => {
  const response = await linkClient.get(
    `/card/payment/${encodeURIComponent(reference)}/status`
  );
  return response.data?.data;
};

// POST /card/payouts, business destination -> { chapa_reference, ... }
const payoutToMerchant = async ({ card_number, amount, merchant_id }) => {
  const response = await linkClient.post("/card/payouts", {
    card_number,
    amount,
    merchant_id,
  });
  return response.data?.data;
};

module.exports = {
  linkClient,
  linkErrorMessage,
  isLinkNotActivated,
  getCard,
  topUpHosted,
  topUpDirectCharge,
  getPaymentStatus,
  payoutToMerchant,
};
