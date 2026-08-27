const mongoose = require("mongoose");

const PaymentConfigSchema = new mongoose.Schema(
  {
    activeProvider: {
      type: String,
      enum: ["CHAPA", "SANTIM"],
      default: "SANTIM",
      required: true,
    },
    // When true, customer ticket payments (Chapa) are routed into a Chapa
    // Link gift card instead of settling directly to the merchant balance.
    giftCardMode: {
      type: Boolean,
      default: false,
    },
    // Chapa Link card_number that receives ticket payments, per currency.
    giftCardRouting: {
      ETB: { type: String, default: null },
      USD: { type: String, default: null },
    },
    // The cinema channel's own version of the two fields above. Kept separate
    // rather than reusing giftCardMode/giftCardRouting so a cinema's takings can
    // be routed to their own dedicated card, distinct from event ticket money —
    // otherwise the two channels' cash would be inseparable inside one card's
    // transaction history. Read only by cinema checkout; event checkout
    // (ticketRoutes.js) never looks at these.
    cinemaGiftCardMode: {
      type: Boolean,
      default: false,
    },
    cinemaGiftCardRouting: {
      ETB: { type: String, default: null },
      USD: { type: String, default: null },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentConfig", PaymentConfigSchema);
