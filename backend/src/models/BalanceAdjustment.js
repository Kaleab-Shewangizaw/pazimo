const mongoose = require("mongoose");

// A manual, explicit correction to what a balance formula would otherwise
// compute — never a silent edit to history. This exists because a floor
// (Math.max(0, ...)) only hides a negative true balance from the screen; it
// does not resolve the fact that money is actually missing. Two known uses:
//
//   1. Completing a half-finished reconciliation: migrateCapitalPoolSeparation.js
//      correctly debited an organizer's Capital pool for principal already
//      paid out through the old, pre-separation ticket withdrawal flow, but
//      never credited the ticket pool back for that same amount — so the
//      ticket pool is left showing a deficit for money that was legitimately
//      paid out, just recorded under the wrong pool before pools existed.
//   2. Writing off a genuine historical overpayment that has no "other half"
//      to complete (a staff-created withdrawal error, a since-fixed
//      pending-ticket-revenue bug whose payout already went out).
//
// Every balance formula that can go negative from a historical data problem
// (financeService.calculateOrganizerBalance, organizerOverviewController,
// organizerController.getOrganizerDashboard, the admin platform total) reads
// this in, so a correction made once here is visible everywhere at once
// instead of needing several coordinated patches.
const BalanceAdjustmentSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stream: {
      type: String,
      enum: ["tickets", "beverages", "capital"],
      required: true,
    },
    currency: {
      type: String,
      enum: ["ETB", "USD"],
      default: "ETB",
      required: true,
    },
    // Positive credits the pool — the only direction any known case has
    // needed so far. This is the correction itself, never re-derived.
    amount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    // A stable, human-legible key so a script can find its own past writes
    // and never double-apply the same correction on a re-run.
    reference: {
      type: String,
      required: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

BalanceAdjustmentSchema.index({ organizer: 1, stream: 1, currency: 1 });

module.exports = mongoose.model("BalanceAdjustment", BalanceAdjustmentSchema);
