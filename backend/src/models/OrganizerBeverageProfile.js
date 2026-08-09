const mongoose = require("mongoose");

// One row per organizer, mirroring OrganizerCapitalProfile: eligibility to sell
// beverages at their events is granted manually by an admin and an organizer
// never grants it to themselves. A row is created lazily the first time an
// admin (or the organizer's own eligibility check) touches it — no row means
// "not_eligible", which is also the stored default.
const OrganizerBeverageProfileSchema = new mongoose.Schema(
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

    // Beverages this organizer may NOT sell — a deny list, not an allow list.
    // Empty (the default) means they can sell the whole active catalogue.
    //
    // Stored as denials on purpose: with an allow list, every beverage added to
    // the catalogue later would be invisible to every organizer an admin had
    // ever narrowed, until someone remembered to reopen each profile. Denials
    // invert that, so a new drink reaches everyone except those explicitly
    // blocked from it. It also matches the admin UI, where every drink starts
    // ticked and unticking one is the deliberate act.
    //
    // Ids are kept even while a beverage is deactivated: a drink pulled for the
    // season and later brought back must not silently lose its block.
    blockedBeverages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Beverage",
      },
    ],
    blockedBeveragesSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    blockedBeveragesSetAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

OrganizerBeverageProfileSchema.index({ eligibility: 1 });

module.exports = mongoose.model(
  "OrganizerBeverageProfile",
  OrganizerBeverageProfileSchema
);
