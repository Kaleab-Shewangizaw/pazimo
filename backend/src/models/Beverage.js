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
    // What kind of product this is.
    //
    // Popcorn and crisps are beverages with a different label, so this is a
    // category on the existing catalogue rather than a parallel Concession model
    // — the cheapest possible way to carry snacks, and the one that leaves every
    // price, stock and revenue path already written working unchanged.
    //
    // Defaults to "drink" so every row that predates this field reads correctly:
    // the catalogue was drinks-only when they were created.
    //
    // "combo" is accepted here but has no bundling behaviour yet — a combo is
    // currently just a product with its own price and its own stock. Decrementing
    // each component's stock on redemption is deliberately not implemented,
    // because whether a combo is priced independently or summed from its parts is
    // still an open question (see docs/BEVERAGE_CINEMA_PLAN.md, B3).
    category: {
      type: String,
      enum: ["drink", "snack", "combo"],
      default: "drink",
      index: true,
    },
    // Inactive beverages stay in the catalogue (and on any past selection)
    // but are hidden from the list organizers pick from.
    isActive: {
      type: Boolean,
      default: true,
    },
    // Who this product belongs to.
    //
    // NULL means the platform catalogue — the admin-curated list every channel
    // can sell from, and what every row created before this field existed is.
    //
    // Set to a cinema means the cinema added it themselves. A counter sells
    // whatever it sells: Coke, Pepsi, water, a brand of crisps nobody else
    // stocks. Making an operator wait for an admin to add each one would either
    // stop them trading or push them into recording it as something it is not,
    // and both are worse than letting them list it.
    //
    // It is still ADMIN-CONTROLLED, just not admin-gated: an admin sees every
    // cinema-owned product, can deactivate one, and can block it for that cinema
    // through the existing blockedBeverages list. What a cinema cannot do is
    // reach into another cinema's products or into the platform catalogue —
    // ownership is checked on every write.
    ownerCinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      // Left unrefed: a platform product is created by an Admin and a
      // cinema-owned one by a User, and those live in different collections.
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

// Case-insensitive uniqueness on name WITHIN AN OWNER: "Heineken" and
// "heineken" must not both exist in the same catalogue, or the picker shows
// apparent duplicates.
//
// Scoped by owner rather than global, because one cinema listing its own
// "Popcorn" must not stop another cinema listing theirs — they are different
// products at different prices that happen to share a word. Platform rows all
// have ownerCinema null, so they keep exactly the global uniqueness they had.
//
// Replacing a global unique index is not something Mongoose does on its own:
// see scripts/migrateBeverageOwnership.js.
BeverageSchema.index(
  { ownerCinema: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
BeverageSchema.index({ isActive: 1, name: 1 });
// The catalogue read is "everything the platform offers plus everything this
// cinema added", which is this index twice.
BeverageSchema.index({ ownerCinema: 1, isActive: 1, name: 1 });

module.exports = mongoose.model("Beverage", BeverageSchema);
