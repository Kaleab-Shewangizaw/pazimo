const mongoose = require("mongoose");

// One row per drink an organizer offers at one event, carrying the price they
// set for it. This is the join that keeps Beverage itself event-agnostic: the
// admin catalogue entry knows nothing about events, and an event's line-up is
// assembled here.
//
// Customer purchases will hang off this row rather than off Beverage, so a row
// is never rewritten in place once sales exist — price changes and withdrawal
// from sale are expressed through the fields below.
//
// A time-boxed discount on this row is NOT stored here — see models/HappyHour.js,
// which is its own campaign referencing one or more of these rows by id, each
// with its own discounted price.
const EventBeverageSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    // Denormalised from Event.organizer so ownership can be checked and an
    // organizer's rows queried without a join. Always copied from the event,
    // never taken from client input.
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    beverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beverage",
      required: true,
    },
    // The organizer's pre-event price, in the currency below.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // ETB-only for now, matching the same v1 decision Loan documents: ticket
    // revenue is tracked per currency and a mixed-currency drinks tab isn't
    // defined yet. Kept as a field so USD can be added without a migration.
    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
    },
    // How many bottles the organizer put up for sale at this event.
    //
    // Defaults to 0 rather than being schema-required so that rows created
    // before stock existed still save; the controller requires a positive
    // number on every new line-up entry.
    stockTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Bottles sold so far. Denormalised from the BeverageSale ledger, which
    // stays the source of truth for money and history. This counter exists so
    // that "is there stock left?" can be answered and decremented in a single
    // atomic update — checking the ledger and then writing would let two
    // concurrent purchases oversell the same last bottle.
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lets an organizer stop selling a drink without deleting the row, which
    // has to survive for any purchases already made against it.
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A drink can only appear once in an event's line-up. Enforced in the database
// rather than by a read-then-write check, which would race under concurrent
// requests from two open tabs.
EventBeverageSchema.index({ event: 1, beverage: 1 }, { unique: true });
EventBeverageSchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model("EventBeverage", EventBeverageSchema);
