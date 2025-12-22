const mongoose = require("mongoose");

const PaymentConfigSchema = new mongoose.Schema(
  {
    activeProvider: {
      type: String,
      enum: ["CHAPA", "SANTIM"],
      default: "SANTIM",
      required: true,
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
