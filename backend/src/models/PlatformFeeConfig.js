const mongoose = require("mongoose");
const { TOTAL_CUT_PERCENT } = require("../config/rates");

// Singleton config: the Chapa merchant that receives the daily platform fee
// skimmed off gift-card ticket sales, plus whether that fee is sent
// automatically or only on demand by an admin.
//
// The default is 3.45%, not 3%: Pazimo's commission is 3% and the government
// levies 15% VAT on that commission, which is passed through to the organizer.
// Sweeping only 3% here while deducting 3.45% from organizer balances would
// leave the VAT stranded in the gift card; sweeping 3.45% while deducting 3%
// would over-collect. Both sides read from config/rates.
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
      default: TOTAL_CUT_PERCENT, // 3.45
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
