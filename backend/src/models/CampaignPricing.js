const mongoose = require("mongoose");

const campaignPricingSchema = new mongoose.Schema(
  {
    smsPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CampaignPricing", campaignPricingSchema);