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
    // The event-beverage "refill" channel's own version of the two fields
    // above, for the same reason cinema has its own: a ticket-holder's drink
    // money is a different pool from their ticket money and must be able to
    // route to a different card without the two becoming inseparable inside
    // one card's transaction history. Read only by beverageCheckoutController's
    // event-refill checkout.
    beverageGiftCardMode: {
      type: Boolean,
      default: false,
    },
    beverageGiftCardRouting: {
      ETB: { type: String, default: null },
      USD: { type: String, default: null },
    },
    // The venue channel's own version, kept separate from the event-beverage
    // pair above for the same reason — a venue's drink takings are a
    // different owner's money entirely. Read only by
    // beverageCheckoutController's venue-refill checkout.
    venueBeverageGiftCardMode: {
      type: Boolean,
      default: false,
    },
    venueBeverageGiftCardRouting: {
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
