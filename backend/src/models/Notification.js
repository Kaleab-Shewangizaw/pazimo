const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Organizer", required: true },
  type: { type: String, enum: ["event_status_change", "withdrawal_status_change"], required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: "Withdrawal" },
  status: { type: String },
  amount: { type: Number },
  eventTitle: { type: String },
});

module.exports = mongoose.model("Notification", notificationSchema); 