const mongoose = require("mongoose");

// Append-only ledger of every credit against a Loan. Manual-only for now
// (an admin records a repayment they've collected outside the platform);
// automated revenue-offset deduction is a later phase, not implemented yet.
const LoanRepaymentSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["ETB", "USD"],
      default: "ETB",
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    outstandingBalanceAfter: {
      type: Number,
      required: true,
    },
    note: String,
  },
  { timestamps: true }
);

LoanRepaymentSchema.index({ loan: 1, createdAt: -1 });
LoanRepaymentSchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model("LoanRepayment", LoanRepaymentSchema);
