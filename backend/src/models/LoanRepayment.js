const mongoose = require("mongoose");

// Append-only ledger of every credit against a Loan.
//
// Most rows are written automatically by loanRepaymentService as the 60% cut
// of post-advance ticket sales accrues — one row per observed increase, not
// one per ticket, since repayment is derived from aggregate revenue rather
// than attributed to individual tickets. Admins can still append a manual row
// for money collected outside the platform.
//
// This ledger is what makes repayment auditable: before it existed the 60%
// was only ever a subtraction inside a formula, with no record that it
// happened and nothing to reconcile against.
const LoanRepaymentSchema = new mongoose.Schema(
  {
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      required: true,
    },
    // "ticket_sales" rows are machine-written from the 60% cut; "manual" rows
    // are entered by an admin and are the only ones that carry recordedBy.
    source: {
      type: String,
      enum: ["ticket_sales", "manual"],
      default: "manual",
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
      required: function requiredForManualRows() {
        return this.source === "manual";
      },
    },
    outstandingBalanceAfter: {
      type: Number,
      required: true,
    },
    // Audit trail for machine-written rows: the gross post-advance ticket
    // revenue observed when this credit was taken, and the running repaid
    // total it produced. Lets an admin re-derive the row from the tickets.
    ticketRevenueBasis: Number,
    totalRepaidAfter: Number,
    note: String,
  },
  { timestamps: true }
);

LoanRepaymentSchema.index({ loan: 1, createdAt: -1 });
LoanRepaymentSchema.index({ organizer: 1, createdAt: -1 });
LoanRepaymentSchema.index({ currency: 1, createdAt: -1 });

module.exports = mongoose.model("LoanRepayment", LoanRepaymentSchema);
