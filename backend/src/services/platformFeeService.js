const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const PlatformFeeConfig = require("../models/PlatformFeeConfig");
const PlatformFeeLedger = require("../models/PlatformFeeLedger");
const GiftCardActivity = require("../models/GiftCardActivity");
const ChapaGiftCardService = require("./chapaGiftCardService");
const { linkErrorMessage } = require("./chapaGiftCardService");
const { VAT_RATE } = require("../config/rates");

// Africa/Addis_Ababa is a fixed UTC+3 offset year-round (no DST) — safe to
// hardcode rather than pull in a timezone library for this one conversion.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// A swept fee is commission plus the VAT charged on that commission, so VAT is
// VAT_RATE/(1 + VAT_RATE) of the total — 15/115ths, not 15%. Getting this
// backwards is the classic VAT-inclusive/exclusive mistake, so it lives in one
// named place. vatAmount is subtracted rather than rounded independently so
// the two parts always add back to feeAmount exactly.
const splitFee = (feeAmount) => {
  const total = round2(feeAmount);
  const vatAmount = round2((total * VAT_RATE) / (1 + VAT_RATE));
  return { commissionAmount: round2(total - vatAmount), vatAmount };
};

// "YYYY-MM-DD" for the EAT calendar day containing `when`
const eatDateKey = (when = new Date()) =>
  new Date(when.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

// [start, end) as real UTC instants bounding the given EAT calendar day
const eatDayBounds = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - EAT_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const shiftDateKey = (dateKey, days) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const getOrCreateConfig = async () => {
  let config = await PlatformFeeConfig.findOne();
  if (!config) config = await PlatformFeeConfig.create({});
  return config;
};

// Sum of gift-card ticket sales that actually completed within the given
// EAT calendar day — keyed off paidAt, not createdAt, so a payment that
// settles just after midnight lands in the right bucket.
const computeDailyTotal = async (dateKey, currency) => {
  const { start, end } = eatDayBounds(dateKey);
  const [row] = await Payment.aggregate([
    {
      $match: {
        provider: "chapa_giftcard",
        status: "PAID",
        currency,
        paidAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$price" },
        paymentCount: { $sum: 1 },
      },
    },
  ]);
  return { totalSales: row?.totalSales || 0, paymentCount: row?.paymentCount || 0 };
};

// Fetch (or create) the ledger row for a day. SENT rows are frozen —
// returned as-is. PENDING/FAILED rows are recomputed from live Payment data
// on every call so late-settling payments still get counted before the fee
// is actually sent.
const ensureLedger = async (dateKey, currency) => {
  let ledger = await PlatformFeeLedger.findOne({ date: dateKey, currency });
  if (ledger && ledger.status === "SENT") return ledger;

  const config = await getOrCreateConfig();
  const { totalSales, paymentCount } = await computeDailyTotal(dateKey, currency);
  const feeAmount = round2(totalSales * (config.feePercentage / 100));

  // The configured percentage is commission + VAT-on-commission as one number
  // (3.45% by default). Split it back out proportionally so the VAT actually
  // owed to the government is recorded per payout, rather than having to be
  // reverse-engineered from a lump sum at filing time. Deriving the split from
  // the configured rate rather than hardcoding it keeps this correct if an
  // admin sets a non-standard percentage.
  const { commissionAmount, vatAmount } = splitFee(feeAmount);

  if (!ledger) {
    ledger = await PlatformFeeLedger.create({
      date: dateKey,
      currency,
      totalSales,
      paymentCount,
      feePercentage: config.feePercentage,
      feeAmount,
      commissionAmount,
      vatAmount,
      status: "PENDING",
    });
  } else {
    ledger.totalSales = totalSales;
    ledger.paymentCount = paymentCount;
    ledger.feePercentage = config.feePercentage;
    ledger.feeAmount = feeAmount;
    ledger.commissionAmount = commissionAmount;
    ledger.vatAmount = vatAmount;
    await ledger.save();
  }
  return ledger;
};

// Send a day's fee to the configured merchant, out of that currency's gift
// card. initiatedBy is "auto" for the scheduler or the admin's identity.
const sendFee = async (dateKey, currency, initiatedBy) => {
  const todayKey = eatDateKey();
  if (dateKey >= todayKey) {
    throw new Error("Cannot send the fee for a day that hasn't fully elapsed yet");
  }

  const config = await getOrCreateConfig();
  if (!config.merchantId) {
    throw new Error("No platform fee merchant configured — set one first");
  }

  const paymentConfig = await PaymentConfig.findOne();
  const cardNumber = paymentConfig?.giftCardRouting?.[currency];
  if (!cardNumber) {
    throw new Error(`No ${currency} gift card is configured for ticket routing`);
  }

  const ledger = await ensureLedger(dateKey, currency);
  if (ledger.status === "SENT") {
    return ledger; // already sent — idempotent no-op
  }
  if (ledger.feeAmount <= 0) {
    throw new Error("Nothing to send — the fee amount is zero for this day");
  }

  const cents = Math.round(ledger.feeAmount * 100);

  try {
    const result = await ChapaGiftCardService.payoutToMerchant({
      card_number: cardNumber,
      amount: cents,
      merchant_id: config.merchantId,
    });

    ledger.status = "SENT";
    ledger.sourceCardNumber = cardNumber;
    ledger.merchantId = config.merchantId;
    ledger.payoutReference =
      result?.chapa_reference || result?.initiator_reference || null;
    ledger.sentAt = new Date();
    ledger.initiatedBy = initiatedBy;
    ledger.errorMessage = undefined;
    await ledger.save();

    // Best-effort — surfaces in the same gift-card transaction history the
    // admin already uses, tagged so it reads clearly as a fee sweep.
    await GiftCardActivity.create({
      cardNumber,
      kind: "payout",
      reference: ledger.payoutReference,
      details: {
        destination: "merchant",
        merchant_id: config.merchantId,
        purpose: "platform_fee",
        date: dateKey,
        currency,
        feePercentage: ledger.feePercentage,
        commissionAmount: ledger.commissionAmount,
        vatAmount: ledger.vatAmount,
      },
      initiatedBy,
    }).catch((error) =>
      console.error("[PLATFORM-FEE] activity log failed:", error.message)
    );

    return ledger;
  } catch (error) {
    ledger.status = "FAILED";
    ledger.errorMessage = linkErrorMessage(error);
    await ledger.save();
    throw error;
  }
};

// Called once daily by the scheduler, shortly after EAT midnight — finalizes
// yesterday's ledger for both currencies and, if auto-send is on, sends it.
const runAutoSendForYesterday = async () => {
  const todayKey = eatDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const config = await getOrCreateConfig();
  if (config.lastAutoRunDate === yesterdayKey) {
    return { skipped: true, date: yesterdayKey };
  }

  for (const currency of ["ETB", "USD"]) {
    try {
      const ledger = await ensureLedger(yesterdayKey, currency);
      if (config.autoSendEnabled && ledger.status !== "SENT" && ledger.feeAmount > 0) {
        await sendFee(yesterdayKey, currency, "auto");
      }
    } catch (error) {
      console.error(
        `[PLATFORM-FEE] auto-run failed for ${yesterdayKey} ${currency}:`,
        error.message
      );
    }
  }

  config.lastAutoRunDate = yesterdayKey;
  await config.save();
  return { skipped: false, date: yesterdayKey };
};

module.exports = {
  splitFee,
  eatDateKey,
  eatDayBounds,
  shiftDateKey,
  getOrCreateConfig,
  computeDailyTotal,
  ensureLedger,
  sendFee,
  runAutoSendForYesterday,
};
