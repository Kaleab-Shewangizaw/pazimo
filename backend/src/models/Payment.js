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
    enum: ["santim", "chapa", "chapa_giftcard"],
    default: "santim",
  },
  // Populated only when provider === "chapa_giftcard": which card received
  // the funds, and the Chapa Link reference used to verify/poll status.
  giftCardNumber: String,
  giftCardLinkReference: {
    type: String,
    index: true,
  },
  invitationType: {
    type: String, // "guest" or "paid"
    default: "guest",
  },
  message: String, // Optional message from organizer
  price: Number,
  currency: {
    type: String,
    enum: ["ETB", "USD"],
    default: "ETB",
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
  },
  ticketDetails: {
    type: Object,
  },
  // The specific Event.ticketTypes subdocument stock was atomically claimed
  // from at checkout-initiation time (see ticketRoutes.js's initiate
  // handlers and utils/ticketStock.js's claimTicketStock). Kept as a real
  // ref alongside the looser `ticketDetails` blob so release/re-claim logic
  // never has to parse it out of that Object.
  ticketTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  // Set the moment the checkout-start stock claim succeeds. Absent means
  // either no hold was ever taken (a payment created before this field
  // existed) or a hold isn't applicable to this record.
  stockHeldAt: {
    type: Date,
  },
  // Set only by markPaymentTerminal (utils/paymentHold.js) when it actually
  // releases a held reservation — on explicit cancel/failure, or the TTL
  // sweep. Distinct from `status` so a stale in-memory `payment` object that
  // later blindly writes `status` can't silently un-release a hold the
  // sweep already gave back to other buyers.
  stockReleasedAt: {
    type: Date,
  },
  // A payment confirmed PAID but for which no ticket could be secured
  // (its hold was already released and the fallback re-claim also failed).
  // Deliberately not a new `status` value — `status` stays "PAID" so
  // existing revenue queries filtering on it are unaffected; this is the
  // signal for manual admin follow-up (no refund automation exists yet).
  needsManualReview: {
    type: Boolean,
    default: false,
    index: true,
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
  // Guards against duplicate SMS when poll + webhook race each other.
  // Set to true atomically by processSuccessfulPayment — only one caller proceeds.
  smsSent: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Set once, at the moment status first flips to PAID — distinct from
  // createdAt (when the payment was initiated). Daily revenue bucketing
  // (platform fee ledger) keys off this so a payment confirmed just after
  // midnight lands in the day it actually completed, not the day it started.
  paidAt: {
    type: Date,
    index: true,
  },
});

// Feeds the stock-hold expiry sweep (utils/stockHoldExpiry.js): find PENDING
// payments whose hold is older than the TTL.
Payment.index({ status: 1, stockHeldAt: 1 });

module.exports = mongoose.model("Payment", Payment);
