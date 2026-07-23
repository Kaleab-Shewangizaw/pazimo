const mongoose = require("mongoose");

// "An organizer can only have one active loan at a time" is a race condition,
// not just a UI rule, so it's enforced with a DB-level partial unique index
// below rather than an application-layer check alone. partialFilterExpression
// only supports equality/$exists/comparison operators (no $in), which is why
// this carries a derived boolean instead of indexing `status` directly.
const LoanSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    approvedAmount: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["ETB", "USD"],
      default: "ETB",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "active",
        "repaid",
        "cancelled",
      ],
      default: "pending",
    },
    blocksNewRequests: {
      type: Boolean,
      default: true,
    },

    // Borrowing-limit snapshot frozen at the moment the request was
    // submitted — the underwriting record for this request. Never recompute
    // this retroactively; re-check live revenue separately at approval time.
    limitAtRequest: {
      type: Number,
      required: true,
    },
    limitBasis: [
      {
        eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
        eventTitle: String,
        eventDate: Date,
        revenue: Number,
      },
    ],

    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    reviewedAt: Date,
    rejectionReason: String,

    // 15% flat fee on the approved principal, set at approval time.
    feeRate: {
      type: Number,
      default: 0.15,
    },
    feeAmount: Number,
    totalRepayable: Number,

    disbursedAt: Date,
    disbursementReference: String,

    outstandingBalance: {
      type: Number,
      default: 0,
    },
    totalRepaid: {
      type: Number,
      default: 0,
    },

    // How many 10-sale repayment milestones the organizer has already been
    // notified about, so the automatic "60% of your last 10 ticket sales went
    // to your advance" message fires once per milestone and never repeats.
    repaymentMilestone: {
      type: Number,
      default: 0,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "cancelledByModel",
    },
    cancelledByModel: {
      type: String,
      enum: ["Admin", "User"],
    },
    cancelledAt: Date,
    cancellationReason: String,

    notes: String,
  },
  { timestamps: true }
);

LoanSchema.index(
  { organizer: 1 },
  { unique: true, partialFilterExpression: { blocksNewRequests: true } }
);
LoanSchema.index({ organizer: 1, status: 1 });
LoanSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Loan", LoanSchema);
