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
