const mongoose = require("mongoose");

// Singleton config: the looping ambient clip that plays on the cinema screen
// behind the seat map while a customer is choosing seats — the same "screen"
// on both the web checkout and the mobile app. Platform-wide, not per-cinema,
// unlike Cinema.promoVideo (that one plays on a single cinema's own page).
const CinemaScreenConfigSchema = new mongoose.Schema(
  {
    // Relative path under /uploads, same convention as Cinema.image/promoVideo.
    video: {
      type: String,
      default: null,
    },
    videoSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    videoSetAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CinemaScreenConfig", CinemaScreenConfigSchema);
