const mongoose = require("mongoose");

// One row per organizer. Eligibility is set manually by an admin — an
// organizer never grants this to themselves. hasActiveLoan is a denormalized
// read-fast flag kept in sync by capitalController whenever a Loan's status
// crosses into/out of the "blocks new requests" set (see Loan.js) — it must
// never be trusted as the source of truth for that check, only Loan is.
const OrganizerCapitalProfileSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    eligibility: {
      type: String,
      enum: ["not_eligible", "eligible"],
      default: "not_eligible",
    },
    eligibilitySetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    eligibilitySetAt: {
      type: Date,
    },
    eligibilityNotes: {
      type: String,
      trim: true,
    },
    hasActiveLoan: {
      type: Boolean,
      default: false,
    },

    // Manual override of the auto-calculated limit (30% of the average of
    // the organizer's last 1-2 events). undefined/null means "use the
    // calculated value" — this is not itself the effective limit, see
    // capitalService.calculateOrganizerCapitalMetrics for how the two combine.
    borrowingLimitOverride: {
      type: Number,
      min: 0,
    },
    borrowingLimitOverrideSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    borrowingLimitOverrideSetAt: {
      type: Date,
    },
    borrowingLimitOverrideNote: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "OrganizerCapitalProfile",
  OrganizerCapitalProfileSchema
);
