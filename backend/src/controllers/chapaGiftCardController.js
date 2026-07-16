const axios = require("axios");
const { StatusCodes } = require("http-status-codes");
const GiftCardActivity = require("../models/GiftCardActivity");

// Best-effort local audit trail — a DB hiccup must never fail the Chapa call
const recordActivity = async (entry) => {
  try {
    await GiftCardActivity.create(entry);
  } catch (error) {
    console.error("[CHAPA-GIFTCARD] failed to record activity:", error.message);
  }
};

const adminIdentity = (req) =>
  req.user?.email || req.user?.id || req.user?._id?.toString() || null;

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

const handleLinkError = (res, error, action) => {
  const httpStatus = error.response?.status;
  const message = linkErrorMessage(error);
  console.error(`[CHAPA-GIFTCARD] ${action} failed:`, {
    message,
    status: httpStatus,
    data: error.response?.data,
  });

  // The Link API answers with "Unauthorized ..." when the merchant account
  // has no Link key yet — surface that as a distinct state so the admin UI
  // can show setup instructions instead of a generic error.
  const notActivated =
    httpStatus === StatusCodes.UNAUTHORIZED ||
    httpStatus === StatusCodes.FORBIDDEN ||
    /unauthorized/i.test(message);

  res.status(httpStatus || StatusCodes.BAD_GATEWAY).json({
    status: "error",
    message,
    linkNotActivated: notActivated || undefined,
  });
};

// GET /api/admin/finance/chapa/giftcards?page=&limit=&phone_number=
const listGiftCards = async (req, res) => {
  try {
    const { page, limit, phone_number } = req.query;
    const params = {};
    if (page) params.page = page;
    if (limit) params.limit = limit;
    if (phone_number) params.phone_number = phone_number;

    const response = await linkClient.get("/card", { params });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || { items: [], page: 1, pages: 1, total: 0 },
    });
  } catch (error) {
    handleLinkError(res, error, "listGiftCards");
  }
};

// POST /api/admin/finance/chapa/giftcards
// body: { first_name, last_name, phone_number, currency }
const createGiftCard = async (req, res) => {
  try {
    const { first_name, last_name, phone_number, currency } = req.body;
    if (!phone_number || !currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "phone_number and currency are required",
      });
    }
    const response = await linkClient.post("/card", {
      first_name,
      last_name,
      phone_number,
      currency,
    });
    const card = response.data?.data;
    if (card?.card_number) {
      await recordActivity({
        cardNumber: card.card_number,
        kind: "create",
        reference: card.ref_id,
        details: { owner_phone: phone_number, first_name, last_name, currency },
        initiatedBy: adminIdentity(req),
      });
    }
    res.status(StatusCodes.CREATED).json({
      status: "success",
      data: card,
    });
  } catch (error) {
    handleLinkError(res, error, "createGiftCard");
  }
};

// GET /api/admin/finance/chapa/giftcards/:cardNumber
const getGiftCard = async (req, res) => {
  try {
    const response = await linkClient.get(
      `/card/${encodeURIComponent(req.params.cardNumber)}`
    );
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data,
    });
  } catch (error) {
    handleLinkError(res, error, "getGiftCard");
  }
};

// PATCH /api/admin/finance/chapa/giftcards/:cardNumber
// body: { status: "enable" | "disable" }
const updateGiftCardStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["enable", "disable"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: 'status must be "enable" or "disable"',
      });
    }
    const response = await linkClient.patch(
      `/card/${encodeURIComponent(req.params.cardNumber)}`,
      { status }
    );
    res.status(StatusCodes.OK).json({
      status: "success",
      message: response.data?.message,
      data: response.data?.data,
    });
  } catch (error) {
    handleLinkError(res, error, "updateGiftCardStatus");
  }
};

// DELETE /api/admin/finance/chapa/giftcards/:cardNumber
const cancelGiftCard = async (req, res) => {
  try {
    const response = await linkClient.delete(
      `/card/${encodeURIComponent(req.params.cardNumber)}`
    );
    res.status(StatusCodes.OK).json({
      status: "success",
      message: response.data?.message || "Gift card cancelled",
    });
  } catch (error) {
    handleLinkError(res, error, "cancelGiftCard");
  }
};

// POST /api/admin/finance/chapa/giftcards/:cardNumber/topup
// body: { type: "hosted" | "direct-charge", amount, phone_number?, payment_method?, merchant_reference? }
const topUpGiftCard = async (req, res) => {
  try {
    const { type, amount, phone_number, payment_method, merchant_reference } =
      req.body;
    if (!["hosted", "direct-charge"].includes(type)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: 'type must be "hosted" or "direct-charge"',
      });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "amount must be a positive number",
      });
    }
    if (type === "direct-charge" && (!phone_number || !payment_method)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "direct-charge requires phone_number and payment_method",
      });
    }

    const payload = {
      type,
      amount: Number(amount),
      card_number: req.params.cardNumber,
    };
    if (merchant_reference) payload.merchant_reference = merchant_reference;
    if (type === "direct-charge") {
      payload.phone_number = phone_number;
      payload.payment_method = payment_method;
    }

    const response = await linkClient.post("/card/payments", payload);
    const result = response.data?.data;
    await recordActivity({
      cardNumber: req.params.cardNumber,
      kind: "topup",
      reference: result?.link_reference,
      details: {
        type,
        payer_phone: type === "direct-charge" ? phone_number : null,
        payment_method: type === "direct-charge" ? payment_method : "hosted checkout",
        merchant_reference: merchant_reference || null,
      },
      initiatedBy: adminIdentity(req),
    });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    handleLinkError(res, error, "topUpGiftCard");
  }
};

// GET /api/admin/finance/chapa/giftcards/payments/:reference/status
const getGiftCardPaymentStatus = async (req, res) => {
  try {
    const response = await linkClient.get(
      `/card/payment/${encodeURIComponent(req.params.reference)}/status`
    );
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data,
    });
  } catch (error) {
    handleLinkError(res, error, "getGiftCardPaymentStatus");
  }
};

// POST /api/admin/finance/chapa/giftcards/:cardNumber/payouts
// Exactly one destination per request:
//   bank/wallet: { amount, bank_slug, account_number, account_name }
//   card-to-card: { amount, destination_card_number }
//   business:     { amount, merchant_id }
const createGiftCardPayout = async (req, res) => {
  try {
    const {
      amount,
      bank_slug,
      account_number,
      account_name,
      destination_card_number,
      merchant_id,
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "amount must be a positive number",
      });
    }
    const destinations = [
      bank_slug ? "bank" : null,
      destination_card_number ? "card" : null,
      merchant_id ? "business" : null,
    ].filter(Boolean);
    if (destinations.length !== 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message:
          "Provide exactly one payout destination: bank_slug (+account), destination_card_number, or merchant_id",
      });
    }
    if (bank_slug && (!account_number || !account_name)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Bank payouts require account_number and account_name",
      });
    }

    const payload = {
      card_number: req.params.cardNumber,
      amount: Number(amount),
    };
    if (bank_slug) {
      payload.bank_slug = bank_slug;
      payload.account_number = account_number;
      payload.account_name = account_name;
    } else if (destination_card_number) {
      payload.destination_card_number = destination_card_number;
    } else {
      payload.merchant_id = merchant_id;
    }

    const response = await linkClient.post("/card/payouts", payload);
    const result = response.data?.data;
    await recordActivity({
      cardNumber: req.params.cardNumber,
      kind: "payout",
      reference:
        result?.chapa_reference || result?.initiator_reference || null,
      details: bank_slug
        ? {
            destination: "bank",
            bank_slug,
            account_number,
            account_name,
          }
        : destination_card_number
        ? { destination: "card", destination_card_number }
        : { destination: "merchant", merchant_id },
      initiatedBy: adminIdentity(req),
    });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    handleLinkError(res, error, "createGiftCardPayout");
  }
};

// Page through a Link list endpoint (payments or payouts). Chapa caps limit
// at 100 per page; the page cap keeps one request from ballooning.
const fetchAllPages = async (path) => {
  const MAX_PAGES = 5;
  const LIMIT = 100;
  let items = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await linkClient.get(path, {
      params: { page, limit: LIMIT },
    });
    const data = response.data?.data || {};
    items = items.concat(data.items || []);
    const pages = data.pages || 1;
    if (page >= pages) break;
    if (page === MAX_PAGES && pages > MAX_PAGES) truncated = true;
  }
  return { items, truncated };
};

const normalizeTopup = (p, local) => ({
  kind: "topup",
  direction: "in",
  card_number: p.card_number,
  reference: p.link_reference || p.chapa_reference,
  chapa_reference: p.chapa_reference || null,
  merchant_reference: p.merchant_reference || null,
  status: (p.status || "").toLowerCase(),
  amount: Number(p.amount) || 0,
  service_fee: Number(p.service_fee) || 0,
  currency: p.currency,
  method: p.payment_method || null,
  counterparty: null,
  mode: p.mode,
  created_at: p.created_at,
  completed_at: p.updated_at || null,
  details: local?.details || null,
  initiated_by: local?.initiatedBy || null,
});

const normalizePayout = (p, local, perspectiveCard) => {
  const isSource = perspectiveCard
    ? p.source_card_number === perspectiveCard
    : true;
  return {
    kind: "payout",
    direction: isSource ? "out" : "in",
    card_number: p.source_card_number,
    reference: p.chapa_reference || p.initiator_reference,
    chapa_reference: p.chapa_reference || null,
    merchant_reference: null,
    status: (p.status || "").toLowerCase(),
    amount: Number(p.amount) || 0,
    service_fee: Number(p.service_fee) || 0,
    currency: p.currency,
    method: p.payout_type || null,
    counterparty: isSource
      ? p.destination_card_number || p.account_number || p.merchant_id || null
      : p.source_card_number || null,
    mode: p.mode,
    created_at: p.created_at,
    completed_at: p.updated_at || null,
    details: local?.details || null,
    initiated_by: local?.initiatedBy || null,
  };
};

// GET /api/admin/finance/chapa/giftcards/:cardNumber/transactions
// The Link API has no per-card filter on its history endpoints, so we page
// through /card/payments (top-ups) and /card/payouts and filter by card
// number ourselves, then merge both into one newest-first timeline.
const getGiftCardTransactions = async (req, res) => {
  try {
    const cardNumber = req.params.cardNumber;

    const [payments, payouts, activities] = await Promise.all([
      fetchAllPages("/card/payments"),
      fetchAllPages("/card/payouts"),
      GiftCardActivity.find({ cardNumber }).lean().catch((error) => {
        console.error(
          "[CHAPA-GIFTCARD] activity lookup failed:",
          error.message
        );
        return [];
      }),
    ]);

    // Local records initiated through the Pazimo admin, keyed by Chapa reference —
    // Chapa's own responses omit payer phones and payout destinations.
    const activityByRef = {};
    let ownerInfo = null;
    for (const activity of activities) {
      if (activity.reference) activityByRef[activity.reference] = activity;
      if (activity.kind === "create") ownerInfo = activity.details || null;
    }

    const transactions = [];

    for (const p of payments.items) {
      if (p.card_number !== cardNumber) continue;
      transactions.push(
        normalizeTopup(p, activityByRef[p.link_reference] || null)
      );
    }

    for (const p of payouts.items) {
      const isSource = p.source_card_number === cardNumber;
      const isDestination = p.destination_card_number === cardNumber;
      if (!isSource && !isDestination) continue;
      const local =
        activityByRef[p.chapa_reference] ||
        activityByRef[p.initiator_reference] ||
        null;
      transactions.push(normalizePayout(p, local, cardNumber));
    }

    transactions.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        transactions,
        owner: ownerInfo,
        truncated: payments.truncated || payouts.truncated,
      },
    });
  } catch (error) {
    handleLinkError(res, error, "getGiftCardTransactions");
  }
};

// GET /api/admin/finance/chapa/giftcards/feed?kind=all|topup|payout&search=&page=&limit=
// Account-wide, searchable transaction feed across every gift card. Merges
// Chapa's payment + payout lists with our local activity records, then filters:
// search matches card numbers, references, phones (payer/owner), bank
// accounts, names, merchant ids, wallets, and the initiating admin.
const getGiftCardFeed = async (req, res) => {
  try {
    const kind = String(req.query.kind || "all").toLowerCase();
    const search = String(req.query.search || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [payments, payouts] = await Promise.all([
      kind === "payout"
        ? { items: [], truncated: false }
        : fetchAllPages("/card/payments"),
      kind === "topup"
        ? { items: [], truncated: false }
        : fetchAllPages("/card/payouts"),
    ]);

    // Join against local records: by reference (indexed) for details, plus
    // every "create" record so cards can be found by their owner's phone.
    const references = [
      ...payments.items.map((p) => p.link_reference),
      ...payouts.items.flatMap((p) => [p.chapa_reference, p.initiator_reference]),
    ].filter(Boolean);

    const activities = await GiftCardActivity.find({
      $or: [{ reference: { $in: references } }, { kind: "create" }],
    })
      .lean()
      .catch((error) => {
        console.error("[CHAPA-GIFTCARD] activity lookup failed:", error.message);
        return [];
      });

    const activityByRef = {};
    const ownerByCard = {};
    for (const activity of activities) {
      if (activity.reference) activityByRef[activity.reference] = activity;
      if (activity.kind === "create" && activity.cardNumber) {
        ownerByCard[activity.cardNumber] = activity.details || null;
      }
    }

    let transactions = [
      ...payments.items.map((p) =>
        normalizeTopup(p, activityByRef[p.link_reference] || null)
      ),
      ...payouts.items.map((p) =>
        normalizePayout(
          p,
          activityByRef[p.chapa_reference] ||
            activityByRef[p.initiator_reference] ||
            null,
          null
        )
      ),
    ];

    // Attach card owner info so results are searchable by the owner's phone
    for (const tx of transactions) {
      tx.owner = ownerByCard[tx.card_number] || null;
    }

    if (search) {
      // Phone searches should match across formats: 09..., 2519..., +2519...
      const searchDigits = search.replace(/\D/g, "");
      const phoneVariants = new Set();
      if (searchDigits.length >= 9) {
        phoneVariants.add(searchDigits);
        if (searchDigits.startsWith("0")) {
          phoneVariants.add("251" + searchDigits.slice(1));
        }
        if (searchDigits.startsWith("251")) {
          phoneVariants.add("0" + searchDigits.slice(3));
        }
      }

      transactions = transactions.filter((tx) => {
        const haystack = [
          tx.card_number,
          tx.reference,
          tx.chapa_reference,
          tx.merchant_reference,
          tx.method,
          tx.status,
          tx.counterparty,
          tx.initiated_by,
          tx.details?.payer_phone,
          tx.details?.payment_method,
          tx.details?.bank_slug,
          tx.details?.account_number,
          tx.details?.account_name,
          tx.details?.destination_card_number,
          tx.details?.merchant_id,
          tx.owner?.owner_phone,
          tx.owner?.first_name,
          tx.owner?.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (haystack.includes(search)) return true;
        if (phoneVariants.size > 0) {
          const haystackDigits = haystack.replace(/[^0-9]/g, " ");
          for (const variant of phoneVariants) {
            if (haystackDigits.includes(variant)) return true;
          }
        }
        return false;
      });
    }

    transactions.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const total = transactions.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const items = transactions.slice((page - 1) * limit, page * limit);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        transactions: items,
        total,
        page,
        pages,
        truncated: payments.truncated || payouts.truncated,
      },
    });
  } catch (error) {
    handleLinkError(res, error, "getGiftCardFeed");
  }
};

// GET /api/admin/finance/chapa/giftcards/banks
// Institutions valid as Link payout destinations. IMPORTANT: Link validates
// bank_slug against the v2 payout bank list (api.chapa.global/v2/payouts/banks),
// NOT the v1 /banks list — v1 slugs like "cbe_bank" are rejected with
// "Invalid bank slug". The "link" store-value entry is for funding cards from
// the business balance, so it's excluded as a withdrawal destination.
const getPayoutBanks = async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.chapa.global/v2/payouts/banks",
      {
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_V2_API_KEY}`,
        },
        timeout: 20000,
      }
    );
    const banks = (response.data?.data || [])
      .filter((b) => b.bank_slug && b.type !== "store_value")
      .map((b) => ({
        slug: b.bank_slug,
        name: b.bank_name,
        type: b.type,
        currencies: Object.keys(b.supported_currencies || {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.status(StatusCodes.OK).json({ status: "success", data: banks });
  } catch (error) {
    handleLinkError(res, error, "getPayoutBanks");
  }
};

// GET /api/admin/finance/chapa/giftcards/payouts?page=&limit=
const listGiftCardPayouts = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const params = {};
    if (page) params.page = page;
    if (limit) params.limit = limit;
    const response = await linkClient.get("/card/payouts", { params });
    res.status(StatusCodes.OK).json({
      status: "success",
      data: response.data?.data || { items: [], page: 1, pages: 1, total: 0 },
    });
  } catch (error) {
    handleLinkError(res, error, "listGiftCardPayouts");
  }
};

module.exports = {
  listGiftCards,
  createGiftCard,
  getGiftCard,
  updateGiftCardStatus,
  cancelGiftCard,
  topUpGiftCard,
  getGiftCardPaymentStatus,
  createGiftCardPayout,
  listGiftCardPayouts,
  getGiftCardTransactions,
  getGiftCardFeed,
  getPayoutBanks,
};
