const mongoose = require("mongoose");

const FraudBlacklistSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    offenseCount: {
      type: Number,
      default: 0,
    },
    incidents: [
      {
        reason: String,
        meta: mongoose.Schema.Types.Mixed,
        at: { type: Date, default: Date.now },
      },
    ],
    bannedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FraudBlacklist", FraudBlacklistSchema);
