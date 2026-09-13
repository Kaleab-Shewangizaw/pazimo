const PaymentConfig = require("../models/PaymentConfig");
const { StatusCodes } = require("http-status-codes");
const { getCard, isLinkNotActivated, linkErrorMessage } = require("../services/chapaGiftCardService");

const getOrCreateConfig = async () => {
  let config = await PaymentConfig.findOne();
  if (!config) {
    config = await PaymentConfig.create({ activeProvider: "CHAPA" });
  }
  return config;
};

const serializeConfig = (config) => ({
  activeProvider: config.activeProvider,
  giftCardMode: config.giftCardMode,
  giftCardRouting: {
    ETB: config.giftCardRouting?.ETB || null,
    USD: config.giftCardRouting?.USD || null,
  },
  cinemaGiftCardMode: config.cinemaGiftCardMode,
  cinemaGiftCardRouting: {
    ETB: config.cinemaGiftCardRouting?.ETB || null,
    USD: config.cinemaGiftCardRouting?.USD || null,
  },
  beverageGiftCardMode: config.beverageGiftCardMode,
  beverageGiftCardRouting: {
    ETB: config.beverageGiftCardRouting?.ETB || null,
    USD: config.beverageGiftCardRouting?.USD || null,
  },
  venueBeverageGiftCardMode: config.venueBeverageGiftCardMode,
  venueBeverageGiftCardRouting: {
    ETB: config.venueBeverageGiftCardRouting?.ETB || null,
    USD: config.venueBeverageGiftCardRouting?.USD || null,
  },
});

// GET /active is fully public (no auth) — every checkout/booking page calls
// it just to know which provider is live. It has no legitimate reason to
// also hand back the actual gift-card numbers money gets routed to; only the
// admin gift-card-routing screens need those, and they already call this
// same endpoint with an admin bearer token. Anonymous/non-admin callers get
// the trimmed shape; admins keep the full one. Found 2026-09-03 — the actual
// card numbers were visible to any visitor via the network tab.
const serializePublicConfig = (config) => ({
  activeProvider: config.activeProvider,
  giftCardMode: config.giftCardMode,
  cinemaGiftCardMode: config.cinemaGiftCardMode,
  beverageGiftCardMode: config.beverageGiftCardMode,
  venueBeverageGiftCardMode: config.venueBeverageGiftCardMode,
});

const getActiveProvider = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const isAdmin = req.user && req.user.role === "admin";
    res.status(StatusCodes.OK).json({
      success: true,
      data: isAdmin ? serializeConfig(config) : serializePublicConfig(config),
    });
  } catch (error) {
    console.error("Error fetching payment config:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch payment configuration",
    });
  }
};

const updateActiveProvider = async (req, res) => {
  try {
    const { provider } = req.body;

    if (!["CHAPA", "SANTIM"].includes(provider)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid provider. Must be CHAPA or SANTIM",
      });
    }

    const config = await getOrCreateConfig();
    config.activeProvider = provider;
    if (req.user) {
      config.updatedBy = req.user.userId;
    }
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Payment provider updated to ${provider}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating payment config:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update payment configuration",
    });
  }
};

// PATCH /api/config/payment/giftcard-mode  { enabled: boolean }
// Toggles whether Chapa ticket payments settle into a gift card instead of
// the merchant balance.
const updateGiftCardMode = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "enabled must be a boolean",
      });
    }

    const config = await getOrCreateConfig();

    if (enabled) {
      const missing = ["ETB", "USD"].filter((c) => !config.giftCardRouting?.[c]);
      if (missing.length) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Set a gift card for ${missing.join(" and ")} before enabling gift card mode`,
        });
      }
    }

    config.giftCardMode = enabled;
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Gift card mode ${enabled ? "enabled" : "disabled"}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating gift card mode:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update gift card mode",
    });
  }
};

// PATCH /api/config/payment/giftcard-routing  { currency: "ETB"|"USD", cardNumber }
// Sets which Chapa Link gift card receives ticket payments made in that currency.
const updateGiftCardRouting = async (req, res) => {
  try {
    const { currency, cardNumber } = req.body;
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "currency must be ETB or USD",
      });
    }
    if (!cardNumber || typeof cardNumber !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "cardNumber is required",
      });
    }

    let card;
    try {
      card = await getCard(cardNumber);
    } catch (error) {
      return res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        message: linkErrorMessage(error),
        linkNotActivated: isLinkNotActivated(error) || undefined,
      });
    }

    if (!card) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Gift card not found",
      });
    }
    if (card.currency !== currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is a ${card.currency} card, not ${currency}`,
      });
    }
    if (card.status !== 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is disabled — enable it first`,
      });
    }

    const config = await getOrCreateConfig();
    config.giftCardRouting = {
      ETB: config.giftCardRouting?.ETB || null,
      USD: config.giftCardRouting?.USD || null,
      [currency]: cardNumber,
    };
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${currency} ticket payments will route to card ${cardNumber}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating gift card routing:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update gift card routing",
    });
  }
};

// PATCH /api/config/payment/cinema-giftcard-mode  { enabled: boolean }
// Toggles whether CINEMA ticket/concession payments settle into a gift card
// instead of the merchant balance. Independent of updateGiftCardMode, which
// governs event ticket payments only.
const updateCinemaGiftCardMode = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "enabled must be a boolean",
      });
    }

    const config = await getOrCreateConfig();

    if (enabled) {
      const missing = ["ETB", "USD"].filter(
        (c) => !config.cinemaGiftCardRouting?.[c]
      );
      if (missing.length) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Set a cinema gift card for ${missing.join(" and ")} before enabling gift card mode`,
        });
      }
    }

    config.cinemaGiftCardMode = enabled;
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Cinema gift card mode ${enabled ? "enabled" : "disabled"}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating cinema gift card mode:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update cinema gift card mode",
    });
  }
};

// PATCH /api/config/payment/cinema-giftcard-routing  { currency: "ETB"|"USD", cardNumber }
// Sets which Chapa Link gift card receives CINEMA payments made in that currency.
const updateCinemaGiftCardRouting = async (req, res) => {
  try {
    const { currency, cardNumber } = req.body;
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "currency must be ETB or USD",
      });
    }
    if (!cardNumber || typeof cardNumber !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "cardNumber is required",
      });
    }

    let card;
    try {
      card = await getCard(cardNumber);
    } catch (error) {
      return res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        message: linkErrorMessage(error),
        linkNotActivated: isLinkNotActivated(error) || undefined,
      });
    }

    if (!card) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Gift card not found",
      });
    }
    if (card.currency !== currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is a ${card.currency} card, not ${currency}`,
      });
    }
    if (card.status !== 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is disabled — enable it first`,
      });
    }

    const config = await getOrCreateConfig();
    config.cinemaGiftCardRouting = {
      ETB: config.cinemaGiftCardRouting?.ETB || null,
      USD: config.cinemaGiftCardRouting?.USD || null,
      [currency]: cardNumber,
    };
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${currency} cinema payments will route to card ${cardNumber}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating cinema gift card routing:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update cinema gift card routing",
    });
  }
};

// PATCH /api/config/payment/beverage-giftcard-mode  { enabled: boolean }
// Toggles whether event-refill drink payments settle into a gift card
// instead of the merchant balance. Independent of updateGiftCardMode
// (event tickets) and updateCinemaGiftCardMode — a ticket-holder's drink
// money is a different pool from their ticket money.
const updateBeverageGiftCardMode = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "enabled must be a boolean",
      });
    }

    const config = await getOrCreateConfig();

    if (enabled) {
      const missing = ["ETB", "USD"].filter(
        (c) => !config.beverageGiftCardRouting?.[c]
      );
      if (missing.length) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Set a beverage gift card for ${missing.join(" and ")} before enabling gift card mode`,
        });
      }
    }

    config.beverageGiftCardMode = enabled;
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Beverage gift card mode ${enabled ? "enabled" : "disabled"}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating beverage gift card mode:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update beverage gift card mode",
    });
  }
};

// PATCH /api/config/payment/beverage-giftcard-routing  { currency, cardNumber }
// Sets which Chapa Link gift card receives event-refill drink payments made
// in that currency.
const updateBeverageGiftCardRouting = async (req, res) => {
  try {
    const { currency, cardNumber } = req.body;
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "currency must be ETB or USD",
      });
    }
    if (!cardNumber || typeof cardNumber !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "cardNumber is required",
      });
    }

    let card;
    try {
      card = await getCard(cardNumber);
    } catch (error) {
      return res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        message: linkErrorMessage(error),
        linkNotActivated: isLinkNotActivated(error) || undefined,
      });
    }

    if (!card) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Gift card not found",
      });
    }
    if (card.currency !== currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is a ${card.currency} card, not ${currency}`,
      });
    }
    if (card.status !== 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is disabled — enable it first`,
      });
    }

    const config = await getOrCreateConfig();
    config.beverageGiftCardRouting = {
      ETB: config.beverageGiftCardRouting?.ETB || null,
      USD: config.beverageGiftCardRouting?.USD || null,
      [currency]: cardNumber,
    };
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${currency} beverage payments will route to card ${cardNumber}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating beverage gift card routing:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update beverage gift card routing",
    });
  }
};

// PATCH /api/config/payment/venue-beverage-giftcard-mode  { enabled: boolean }
// Toggles whether venue drink payments settle into a gift card instead of
// the merchant balance. Independent of every other channel's gift-card
// toggle — a venue's drink takings are a different owner's money entirely.
const updateVenueBeverageGiftCardMode = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "enabled must be a boolean",
      });
    }

    const config = await getOrCreateConfig();

    if (enabled) {
      const missing = ["ETB", "USD"].filter(
        (c) => !config.venueBeverageGiftCardRouting?.[c]
      );
      if (missing.length) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: `Set a venue beverage gift card for ${missing.join(" and ")} before enabling gift card mode`,
        });
      }
    }

    config.venueBeverageGiftCardMode = enabled;
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Venue beverage gift card mode ${enabled ? "enabled" : "disabled"}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating venue beverage gift card mode:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update venue beverage gift card mode",
    });
  }
};

// PATCH /api/config/payment/venue-beverage-giftcard-routing  { currency, cardNumber }
// Sets which Chapa Link gift card receives venue drink payments made in that
// currency.
const updateVenueBeverageGiftCardRouting = async (req, res) => {
  try {
    const { currency, cardNumber } = req.body;
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "currency must be ETB or USD",
      });
    }
    if (!cardNumber || typeof cardNumber !== "string") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "cardNumber is required",
      });
    }

    let card;
    try {
      card = await getCard(cardNumber);
    } catch (error) {
      return res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        message: linkErrorMessage(error),
        linkNotActivated: isLinkNotActivated(error) || undefined,
      });
    }

    if (!card) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Gift card not found",
      });
    }
    if (card.currency !== currency) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is a ${card.currency} card, not ${currency}`,
      });
    }
    if (card.status !== 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Card ${cardNumber} is disabled — enable it first`,
      });
    }

    const config = await getOrCreateConfig();
    config.venueBeverageGiftCardRouting = {
      ETB: config.venueBeverageGiftCardRouting?.ETB || null,
      USD: config.venueBeverageGiftCardRouting?.USD || null,
      [currency]: cardNumber,
    };
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `${currency} venue payments will route to card ${cardNumber}`,
      data: serializeConfig(config),
    });
  } catch (error) {
    console.error("Error updating venue beverage gift card routing:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update venue beverage gift card routing",
    });
  }
};

module.exports = {
  getActiveProvider,
  updateActiveProvider,
  updateGiftCardMode,
  updateGiftCardRouting,
  updateCinemaGiftCardMode,
  updateCinemaGiftCardRouting,
  updateBeverageGiftCardMode,
  updateBeverageGiftCardRouting,
  updateVenueBeverageGiftCardMode,
  updateVenueBeverageGiftCardRouting,
};
