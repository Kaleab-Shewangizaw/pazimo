const mongoose = require("mongoose");
const { TOTAL_CUT_PERCENT } = require("../config/rates");

// One row per (calendar day, currency) — the daily platform-fee record.
// PENDING rows are recomputed from live Payment data on every read (to pick
// up late-settling payments); once SENT, totals are frozen as the
// historical record of what was actually paid out.
const PlatformFeeLedgerSchema = new mongoose.Schema(
  {
    // "YYYY-MM-DD" in Africa/Addis_Ababa (EAT, UTC+3, no DST)
    date: {
      type: String,
      required: true,
    },
    currency: {
      type: String,
      enum: ["ETB", "USD"],
      required: true,
    },
    totalSales: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentCount: {
      type: Number,
      default: 0,
    },
    feePercentage: {
      type: Number,
      required: true,
      default: TOTAL_CUT_PERCENT,
    },
    feeAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    // How feeAmount splits between Pazimo's own commission and the VAT levied
    // on it. Stored rather than derived so a historical SENT row still shows
    // the correct split if the rates change later — the VAT figure is what
    // gets filed, so it must be frozen alongside the payout it came from.
    commissionAmount: {
      type: Number,
      default: 0,
    },
    vatAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
    },
    sourceCardNumber: String,
    merchantId: String,
    payoutReference: String,
    sentAt: Date,
    // "auto" (scheduler) or the admin's email/id
    initiatedBy: String,
    errorMessage: String,
  },
  { timestamps: true }
);

PlatformFeeLedgerSchema.index({ date: 1, currency: 1 }, { unique: true });

module.exports = mongoose.model("PlatformFeeLedger", PlatformFeeLedgerSchema);
