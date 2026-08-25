const mongoose = require("mongoose");

const SantimTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    merchantId: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "ETB",
    },
    paymentReason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "CANCELLED"],
      default: "PENDING",
    },
    paymentUrl: {
      type: String,
    },
    metaData: {
      fullName: { type: String },
      email: { type: String },
      phoneNumber: { type: String },
      ticketTypeId: { type: String },
      eventId: { type: String },
      quantity: { type: String },
      userId: { type: String },
      ticketId: { type: String }, // Added ticketId
      type: { type: String },
      contactType: { type: String },
      guestType: { type: String },
      message: { type: String },
      pendingInvitationIds: {
        type: [String],
        default: [],
      },
    },
    santimPayReference: {
      type: String,
    },
    // Same hold/release bookkeeping as Payment.js — see that model for the
    // full rationale. Kept at the top level (not inside metaData, which
    // stays untouched for backward compat) as real, queryable fields.
    ticketTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    stockHeldAt: {
      type: Date,
    },
    stockReleasedAt: {
      type: Date,
    },
    needsManualReview: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Feeds the stock-hold expiry sweep (utils/stockHoldExpiry.js).
SantimTransactionSchema.index({ status: 1, stockHeldAt: 1 });

module.exports = mongoose.model("SantimTransaction", SantimTransactionSchema);
