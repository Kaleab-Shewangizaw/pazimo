const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const invitationSchema = new mongoose.Schema(
  {
    invitationId: {
      type: String,
      unique: true,
      default: uuidv4,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    guestName: {
      type: String,
      required: true,
    },
    guestEmail: {
      type: String,
    },
    guestPhone: {
      type: String,
    },
    guestType: {
      type: String,
      enum: ["guest", "paid"],
      default: "guest",
    },
    type: {
      type: String,
      enum: ["email", "sms", "both"],
      required: true,
    },
    amount: {
      type: Number,
      default: 1,
      min: 0,
      max: 10,
    },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "paid",
        "sent",
        "delivered",
        "failed",
        "confirmed",
        "declined",
      ],
      default: "pending_payment",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "free"],
      default: "pending",
    },
    paymentReference: {
      type: String,
    },
    qrCodeData: {
      type: String,
    },
    rsvpLink: {
      type: String,
    },
    rsvpStatus: {
      type: String,
      enum: ["pending", "confirmed", "declined"],
      default: "pending",
    },
    rsvpConfirmedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Invitation", invitationSchema);
