const mongoose = require("mongoose");

const Payment = new mongoose.Schema({
  transactionId: String,
  status: {
    type: String,
    enum: ["PENDING", "PAID", "FAILED"],
    default: "PENDING",
  },
  guestName: String,
  contact: String,
  method: String, // "email" or "sms"
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Payment", Payment);
