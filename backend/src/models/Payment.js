const mongoose = require("mongoose");

const Payment = new mongoose.Schema({
  transactionId: String,
  status: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED", "CANCELLED"],
    default: "PENDING",
  },
  guestName: String,
  contact: String, // For logged-in users: account phone; For guests: payment phone
  paymentPhone: String, // The actual phone number used for payment (always stored)
  method: String, // "email" or "sms"
  provider: {
    type: String,
    enum: ["santim", "chapa"],
    default: "santim",
  },
  invitationType: {
    type: String, // "guest" or "paid"
    default: "guest",
  },
  message: String, // Optional message from organizer
  price: Number,
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  ticketDetails: {
    type: Object,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  santimPayResponse: {
    type: Object,
  },
  newUserCreated: {
    type: Boolean,
    default: false,
  },
  newUserEmail: {
    type: String,
  },
  newUserPassword: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Payment", Payment);
