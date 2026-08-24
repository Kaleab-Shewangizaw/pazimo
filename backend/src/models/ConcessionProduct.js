const mongoose = require("mongoose");

// The admin-managed catalogue of what a cinema counter can sell — popcorn,
// soda, candy, combos. This is deliberately its OWN collection rather than a
// row on Beverage.
//
// Beverage is the platform's drinks catalogue for events and venues: someone
// buying a ticket adds a beer to their order. A cinema counter sells a
// different kind of thing, priced and reported differently, to a customer who
// is not buying a drink to go with an event ticket — they are buying a cinema
// snack. The two used to share a table, distinguished only by a `category`
// field and an `ownerCinema` escape hatch, and that plumbing was already
// leaking: creating a "concession" meant hitting the beverages admin API, and
// the beverages admin API had no way to keep a cinema's popcorn out of an
// event organizer's drink picker. Two products that share nothing about how
// they are sold, priced, reported or governed do not belong in one table just
// because both happen to be edible.
//
// Admin creates and owns every row — a cinema only prices and sells from this
// catalogue (see CinemaBeverage), it never adds to it. That is why there is no
// owner field here at all, unlike the ownerCinema experiment Beverage briefly
// carried.
const ConcessionProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    // Relative path (e.g. "/uploads/1746842922821.PNG"), matching Beverage —
    // the API host serves /uploads statically and the frontend prefixes
    // NEXT_PUBLIC_API_URL.
    image: {
      type: String,
      default: null,
    },
    // Brand colour, as #rrggbb. Only the hue is really used: the UI derives a
    // fixed set of shades from it in OKLCH so every card sits at the same
    // perceived lightness whatever colour is chosen. Null falls back to the
    // UI's default amber.
    color: {
      type: String,
      default: null,
      match: [/^#[0-9a-f]{6}$/, "Colour must be a hex value like #1f7a3f"],
    },
    // What kind of product this is, for grouping on a cinema's own line-up and
    // sales screens. "combo" is accepted but has no bundling behaviour yet — a
    // combo is currently just a product with its own price and its own stock.
    category: {
      type: String,
      enum: ["drink", "snack", "combo"],
      default: "snack",
      index: true,
    },
    // Inactive products stay in the catalogue (and on any cinema's past
    // line-up or sale) but are hidden from what a cinema can newly add.
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness on name: "Popcorn" and "popcorn" must not both
// exist, or the picker shows apparent duplicates. Global — every row here is
// admin-owned, so there is no per-owner scope to key it by.
ConcessionProductSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
ConcessionProductSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model("ConcessionProduct", ConcessionProductSchema);
