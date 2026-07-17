const { StatusCodes } = require("http-status-codes");
const {
  eatDateKey,
  shiftDateKey,
  getOrCreateConfig,
  computeDailyTotal,
  ensureLedger,
  sendFee,
} = require("../services/platformFeeService");
const { isLinkNotActivated, linkErrorMessage } = require("../services/chapaGiftCardService");

const adminIdentity = (req) =>
  req.user?.email || req.user?.id || req.user?._id?.toString() || null;

const serializeConfig = (config) => ({
  merchantName: config.merchantName,
  merchantId: config.merchantId,
  feePercentage: config.feePercentage,
  autoSendEnabled: config.autoSendEnabled,
  lastAutoRunDate: config.lastAutoRunDate,
});

// GET /api/admin/finance/platform-fee/config
const getConfig = async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.status(StatusCodes.OK).json({ status: "success", data: serializeConfig(config) });
  } catch (error) {
    console.error("[PLATFORM-FEE] getConfig failed:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch platform fee configuration",
    });
  }
};

// PATCH /api/admin/finance/platform-fee/config
// body: { merchantName?, merchantId?, feePercentage?, autoSendEnabled? }
const updateConfig = async (req, res) => {
  try {
    const { merchantName, merchantId, feePercentage, autoSendEnabled } = req.body;

    // Chapa Link has no lookup endpoint for a merchant_id — it can only be
    // validated by actually sending a payout to it, so just check shape here.
    if (merchantId !== undefined) {
      if (typeof merchantId !== "string" || !merchantId.trim()) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: "error",
          message: "merchantId must be a non-empty string",
        });
      }
    }

    if (feePercentage !== undefined) {
      const pct = Number(feePercentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: "error",
          message: "feePercentage must be a number between 0 and 100",
        });
      }
    }

    if (autoSendEnabled !== undefined && typeof autoSendEnabled !== "boolean") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "autoSendEnabled must be a boolean",
      });
    }

    const config = await getOrCreateConfig();
    if (merchantName !== undefined) config.merchantName = merchantName.trim() || null;
    if (merchantId !== undefined) config.merchantId = merchantId.trim();
    if (feePercentage !== undefined) config.feePercentage = Number(feePercentage);
    if (autoSendEnabled !== undefined) config.autoSendEnabled = autoSendEnabled;
    if (req.user) config.updatedBy = req.user.userId;
    await config.save();

    res.status(StatusCodes.OK).json({ status: "success", data: serializeConfig(config) });
  } catch (error) {
    console.error("[PLATFORM-FEE] updateConfig failed:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to update platform fee configuration",
    });
  }
};

// GET /api/admin/finance/platform-fee/daily?currency=ETB&days=14
// Returns today's live (unsent) preview plus a history of the last `days`
// fully-elapsed EAT calendar days, oldest first.
const getDaily = async (req, res) => {
  try {
    const currency = String(req.query.currency || "").toUpperCase();
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "currency must be ETB or USD",
      });
    }
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));

    const todayKey = eatDateKey();
    const todayTotals = await computeDailyTotal(todayKey, currency);
    const config = await getOrCreateConfig();

    const dateKeys = [];
    for (let i = days; i >= 1; i--) dateKeys.push(shiftDateKey(todayKey, -i));

    const history = [];
    for (const dateKey of dateKeys) {
      history.push(await ensureLedger(dateKey, currency));
    }

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        today: {
          date: todayKey,
          totalSales: todayTotals.totalSales,
          paymentCount: todayTotals.paymentCount,
          feeAmount: Math.round(todayTotals.totalSales * (config.feePercentage / 100) * 100) / 100,
          feePercentage: config.feePercentage,
        },
        history,
      },
    });
  } catch (error) {
    console.error("[PLATFORM-FEE] getDaily failed:", error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch daily platform fee data",
    });
  }
};

// POST /api/admin/finance/platform-fee/send
// body: { date: "YYYY-MM-DD", currency: "ETB"|"USD" }
const sendDailyFee = async (req, res) => {
  try {
    const { date, currency } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "date must be in YYYY-MM-DD format",
      });
    }
    if (!["ETB", "USD"].includes(currency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "currency must be ETB or USD",
      });
    }

    const ledger = await sendFee(date, currency, adminIdentity(req));
    res.status(StatusCodes.OK).json({ status: "success", data: ledger });
  } catch (error) {
    console.error("[PLATFORM-FEE] sendDailyFee failed:", error.message);
    const httpStatus = error.response?.status;
    res.status(httpStatus || StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: linkErrorMessage(error) || error.message,
      linkNotActivated: isLinkNotActivated(error) || undefined,
    });
  }
};

module.exports = {
  getConfig,
  updateConfig,
  getDaily,
  sendDailyFee,
};
