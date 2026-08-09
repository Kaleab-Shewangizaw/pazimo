const mongoose = require("mongoose");

// Admin-managed master catalogue of drinks (beers, soft drinks, ...). This is
// the platform-wide list only — it is deliberately NOT tied to an Event or an
// organizer. The next step layers the per-event selection on top as its own
// collection, roughly:
//
//   EventBeverage { event, organizer, beverage, sellingPrice, currency, ... }
//   with a unique index on { event, beverage }
//
// so the same Beverage row can be sold by many organizers at different prices
// without ever being duplicated or mutated per event.
const BeverageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Beverage name is required"],
      trim: true,
    },
    // Relative path (e.g. "/uploads/1746842922821.PNG"), matching how Category
    // and Event store their images — the API host serves /uploads statically
    // and the frontend prefixes NEXT_PUBLIC_API_URL.
    image: {
      type: String,
      default: null,
    },
    // Brand colour, as #rrggbb. Only the hue is really used: the UI derives a
    // fixed set of shades from it in OKLCH so every card sits at the same
    // perceived lightness whatever colour is chosen (see lib/beverage-color).
    // Null means the UI falls back to its default amber.
    color: {
      type: String,
      default: null,
      match: [/^#[0-9a-f]{6}$/, "Colour must be a hex value like #1f7a3f"],
    },
    // Inactive beverages stay in the catalogue (and on any past selection)
    // but are hidden from the list organizers pick from.
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

// Case-insensitive uniqueness on name: "Heineken" and "heineken" must not both
// exist, otherwise the organizer-facing picker shows apparent duplicates.
BeverageSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
BeverageSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model("Beverage", BeverageSchema);
