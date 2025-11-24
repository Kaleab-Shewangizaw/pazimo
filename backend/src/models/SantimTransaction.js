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
      pendingInvitationIds: {
        type: [String],
        default: [],
      },
    },
    santimPayReference: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SantimTransaction", SantimTransactionSchema);
