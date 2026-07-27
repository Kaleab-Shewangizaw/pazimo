const mongoose = require("mongoose");

// Singleton config: the Chapa merchant that receives the daily 3% platform
// fee skimmed off gift-card ticket sales, plus whether that fee is sent
// automatically or only on demand by an admin.
const PlatformFeeConfigSchema = new mongoose.Schema(
  {
    merchantName: {
      type: String,
      default: null,
    },
    merchantId: {
      type: String,
      default: null,
    },
    feePercentage: {
      type: Number,
      default: 3,
    },
    autoSendEnabled: {
      type: Boolean,
      default: false,
    },
    // "YYYY-MM-DD" (Africa/Addis_Ababa) of the last calendar day the
    // scheduler finalized — guards against reprocessing the same day on
    // every scheduler tick.
    lastAutoRunDate: {
      type: String,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformFeeConfig", PlatformFeeConfigSchema);
