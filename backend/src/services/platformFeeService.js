const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const PlatformFeeConfig = require("../models/PlatformFeeConfig");
const PlatformFeeLedger = require("../models/PlatformFeeLedger");
const GiftCardActivity = require("../models/GiftCardActivity");
const ChapaGiftCardService = require("./chapaGiftCardService");
const { linkErrorMessage } = require("./chapaGiftCardService");

// Africa/Addis_Ababa is a fixed UTC+3 offset year-round (no DST) — safe to
// hardcode rather than pull in a timezone library for this one conversion.
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

/**
 * "This payment settled inside this window", for rows that record when they
 * settled and rows that do not.
 *
 * Exported so the reporting script and the daily computation cannot drift: a
 * classification table that counted a different set from the figures beneath it
 * would be worse than no table.
 */
const settledInRange = (start, end) => ({
  $or: [
    { paidAt: { $gte: start, $lt: end } },
    { paidAt: { $exists: false }, createdAt: { $gte: start, $lt: end } },
    { paidAt: null, createdAt: { $gte: start, $lt: end } },
  ],
});

// What counts as a ticket sale for platform-fee purposes.
//
// The Payment collection is shared by four different things: ticket purchases,
// invitation email/SMS fees, campaign payments, and cash taken at the door.
// Only the first is ticket revenue Pazimo takes a commission on — the
// invitation and campaign fees are ALREADY 100% platform income, so sweeping a
// further 3% off them would be charging ourselves a fee on our own money.
//
// The purposes are separated by what each writer puts in `ticketDetails`:
// ticket purchases record `ticketCount`, invitation payments record
// `qrCodeCount`, campaign payments record `campaignId`. `invitationType` alone
// cannot do it, because a plain ticket sale sets nothing and so inherits the
// schema default of "guest" — the same value an invitation payment uses.
//
// On-door sales are excluded deliberately. They are cash handed over at the
// gate; no money moved through a provider, so there is nothing for a sweep to
// move. The commission on them is still real and is still recorded by the
// ledger — it is only this settlement mechanism that cannot act on it.
const ticketSaleMatch = (currency, start, end) => ({
  status: "PAID",
  currency,
  // WHEN a payment settled, for rows that record it AND rows that do not.
  //
  // `paidAt` is the right field and is preferred wherever it exists: it is set
  // the moment status flips to PAID, so a payment confirmed just after midnight
  // lands in the day it actually completed rather than the day it started.
  //
  // But it was added long after Payment was in use, and a range query on it
  // silently excludes every row written before that. Measured on a production
  // mirror: 8,685 of 9,744 PAID payments have no `paidAt`, hiding 8,090 ticket
  // sales worth 19,992,281 ETB and 599,768.43 ETB of commission — against a
  // sweep that reported 45,989.34 owed and looked plausible.
  //
  // So older rows fall back to `createdAt`, which for those rows is the only
  // signal there is. It can misfile a payment that was initiated just before
  // midnight and confirmed just after — a rounding error at the day boundary,
  // and immeasurably better than the row being invisible.
  //
  // Written as indexable branches rather than an $expr over $ifNull: an $expr
  // comparison cannot use the paidAt index, and this query runs per day across
  // the whole history.
  ...settledInRange(start, end),
  "ticketDetails.ticketCount": { $exists: true, $ne: null },
  "ticketDetails.qrCodeCount": { $exists: false },
  "ticketDetails.campaignId": { $exists: false },
  invitationType: { $nin: ["campaign", "on-door", "bulk_invitation_fee"] },
});

// Sum of ticket sales that actually completed within the given EAT calendar day
// — keyed off paidAt, not createdAt, so a payment that settles just after
// midnight lands in the right bucket.
//
// FIXED 2026-08-20. This used to also filter `provider: "chapa_giftcard"`.
// Production holds zero payments with that provider — 18,186 chapa, 160 santim,
// 1,257 with none recorded — because a payment is only marked chapa_giftcard
// when gift-card routing is configured, and it never was. So this returned 0
// every single day, every one of the 74 ledger rows was zero, and nothing was
// ever swept, against 701,493.24 ETB of commission earned.
//
// `giftCardSales` keeps the old figure as a separate number rather than a
// filter, because it is still the one that matters at payout time: sendFee()
// draws from a gift card, so it can only actually source the part of the day
// that landed in one. Recording both makes the gap visible instead of silently
// reporting a fee as owed that no configured card can pay.
const computeDailyTotal = async (dateKey, currency) => {
  const { start, end } = eatDayBounds(dateKey);
  const [row] = await Payment.aggregate([
    { $match: ticketSaleMatch(currency, start, end) },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$price" },
        paymentCount: { $sum: 1 },
        giftCardSales: {
          $sum: {
            $cond: [{ $eq: ["$provider", "chapa_giftcard"] }, "$price", 0],
          },
        },
      },
    },
  ]);
  return {
    totalSales: round2(row?.totalSales || 0),
    paymentCount: row?.paymentCount || 0,
    giftCardSales: round2(row?.giftCardSales || 0),
  };
};

// Fetch (or create) the ledger row for a day. SENT rows are frozen —
// returned as-is. PENDING/FAILED rows are recomputed from live Payment data
// on every call so late-settling payments still get counted before the fee
// is actually sent.
const ensureLedger = async (dateKey, currency) => {
  let ledger = await PlatformFeeLedger.findOne({ date: dateKey, currency });
  if (ledger && ledger.status === "SENT") return ledger;

  const config = await getOrCreateConfig();
  const { totalSales, paymentCount, giftCardSales } = await computeDailyTotal(
    dateKey,
    currency
  );
  const feeAmount = round2(totalSales * (config.feePercentage / 100));

  if (!ledger) {
    ledger = await PlatformFeeLedger.create({
      date: dateKey,
      currency,
      totalSales,
      paymentCount,
      giftCardSales,
      feePercentage: config.feePercentage,
      feeAmount,
      status: "PENDING",
    });
  } else {
    ledger.totalSales = totalSales;
    ledger.paymentCount = paymentCount;
    ledger.giftCardSales = giftCardSales;
    ledger.feePercentage = config.feePercentage;
    ledger.feeAmount = feeAmount;
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
  settledInRange,
  ticketSaleMatch,
  eatDateKey,
  eatDayBounds,
  shiftDateKey,
  getOrCreateConfig,
  computeDailyTotal,
  ensureLedger,
  sendFee,
  runAutoSendForYesterday,
};
