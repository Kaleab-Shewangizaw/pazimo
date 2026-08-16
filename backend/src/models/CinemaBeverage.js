const mongoose = require("mongoose");

// One row per product a cinema offers, carrying the price that cinema sells it
// at. The cinema-channel twin of EventBeverage and VenueBeverage, and it exists
// for the same reason: it keeps Beverage itself channel-agnostic. The catalogue
// entry knows nothing about cinemas, events or venues, and each channel
// assembles its own line-up here.
//
// The same Beverage can therefore be 150 ETB at an event, 180 at a club and 200
// at a cinema, without the catalogue row ever being duplicated or mutated. This
// is why cinema pricing must never be written onto Beverage.
const CinemaBeverageSchema = new mongoose.Schema(
  {
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },
    beverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beverage",
      required: true,
    },
    // The cinema's selling price, in the currency below.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // ETB-only for now, matching EventBeverage and VenueBeverage — concession
    // revenue is tracked per currency and a mixed-currency counter isn't
    // defined. Kept as a field so USD can be added without a migration.
    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
    },
    // How many the cinema has put up for sale.
    //
    // Like a venue and unlike an event, a cinema restocks continuously, so this
    // is a running figure an operator tops up rather than a one-off allocation.
    // The sold-vs-stock arithmetic is identical either way.
    stockTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Sold so far. Denormalised from the CinemaBeverageSale ledger, which stays
    // the source of truth for money. This counter exists so "is there stock
    // left?" can be answered and decremented in one atomic update — checking the
    // ledger and then writing would let two concurrent purchases oversell the
    // same last bucket of popcorn.
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lets a cinema stop selling a product without deleting the row, which has
    // to survive for any purchases already made against it.
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A product can only appear once in a cinema's line-up. Enforced in the database
// rather than by a read-then-write check, which would race under concurrent
// requests from two open tabs.
CinemaBeverageSchema.index({ cinema: 1, beverage: 1 }, { unique: true });
CinemaBeverageSchema.index({ cinema: 1, createdAt: -1 });

module.exports = mongoose.model("CinemaBeverage", CinemaBeverageSchema);
