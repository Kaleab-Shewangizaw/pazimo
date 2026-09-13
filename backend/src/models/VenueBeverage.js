const mongoose = require("mongoose");

// One row per drink a venue offers, carrying the price that venue sells it at.
// The venue-channel twin of EventBeverage, and it exists for the same reason:
// it keeps Beverage itself channel-agnostic. The catalogue entry knows nothing
// about venues or events, and each channel assembles its own line-up here.
//
// The same Beverage can therefore be 120 ETB at one club, 90 at a restaurant and
// 150 at an event, without the catalogue row ever being duplicated or mutated.
//
// A time-boxed discount on this row is NOT stored here — see models/HappyHour.js.
const VenueBeverageSchema = new mongoose.Schema(
  {
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    beverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beverage",
      required: true,
    },
    // The venue's selling price, in the currency below.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // ETB-only for now, matching EventBeverage — beverage revenue is tracked per
    // currency and a mixed-currency bar tab isn't defined. Kept as a field so
    // USD can be added without a migration.
    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
    },
    // How many the venue has put up for sale.
    //
    // Unlike an event, a venue restocks continuously, so this is a running
    // figure an operator tops up rather than a one-off allocation. The
    // sold-vs-stock arithmetic is identical either way.
    stockTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Sold so far. Denormalised from the VenueBeverageSale ledger, which stays
    // the source of truth for money. This counter exists so "is there stock
    // left?" can be answered and decremented in one atomic update — checking the
    // ledger and then writing would let two concurrent purchases oversell the
    // same last bottle.
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lets a venue stop selling a drink without deleting the row, which has to
    // survive for any purchases already made against it.
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A drink can only appear once in a venue's line-up. Enforced in the database
// rather than by a read-then-write check, which would race under concurrent
// requests from two open tabs.
VenueBeverageSchema.index({ venue: 1, beverage: 1 }, { unique: true });
VenueBeverageSchema.index({ venue: 1, createdAt: -1 });

module.exports = mongoose.model("VenueBeverage", VenueBeverageSchema);
