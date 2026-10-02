const mongoose = require("mongoose");

// A happy hour is a CAMPAIGN, not a per-drink toggle: an organizer/venue
// picks one or more drinks from their existing line-up, sets a discounted
// price for each, and one shared duration + start time governs all of them
// together. This replaced an earlier per-EventBeverage/VenueBeverage
// `happyHour` subdocument design — that made "add a happy hour to one drink"
// easy but had no way to publish "30% off everything from 6-7pm" as the one
// action it actually is.
//
// Status ("scheduled"/"active"/"ended") is still never stored — see
// utils/happyHour.js, which derives it from wall-clock time the same way
// utils/ticketAvailability.js does for wave transitions. What IS stored here
// is only what was actually decided: which drinks, at what price, for how
// long, starting how.
const HappyHourItemSchema = new mongoose.Schema(
  {
    // The EventBeverage or VenueBeverage row this discount applies to — which
    // collection depends on this document's own `scope`, so this carries no
    // schema `ref` (resolved by hand in the controllers/services, the same
    // reason BeverageShare.items.sale doesn't either).
    lineup: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // The discounted price for this one drink. Validated at creation to be
    // lower than that drink's regular price — a "happy hour" that costs more
    // is just a price change wearing a countdown.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // How many units may be sold at `price` before this drink drops back to
    // its regular price — "the first 100 beers at 50 ETB". null means no cap
    // of its own: the discount then runs until the timer ends or the drink's
    // own stock does. Whichever of timer/cap runs out first ends it.
    quantityLimit: {
      type: Number,
      min: 1,
      default: null,
    },
    // Units actually sold at the discounted price so far. Only ever moved by
    // the atomic claim in utils/happyHour.js (claimHappyHourUnits), never
    // read-then-written, so two buyers can't both take the last discounted
    // unit.
    sold: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Stamped when `sold` reaches `quantityLimit` — lets a campaign whose
    // every drink sold out report when it actually ended.
    soldOutAt: Date,
  },
  { _id: false }
);

const HappyHourSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ["EVENT", "VENUE"],
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      index: true,
    },
    // Denormalised from Event.organizer, same reasoning EventBeverage.organizer
    // gives — ownership checked and an organizer's campaigns queried without a
    // join, and always copied from the event, never taken from client input.
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      index: true,
    },

    items: {
      type: [HappyHourItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A happy hour needs at least one drink",
      },
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    startMode: {
      type: String,
      enum: ["manual", "scheduled"],
      required: true,
    },
    // Only meaningful when startMode is "scheduled".
    scheduledStartAt: Date,
    // Set only by the manual "Start now" action — publishing a manual happy
    // hour does not start it.
    startedAt: Date,

    // Cancelled campaigns are kept, not deleted — an admin reviewing what
    // happened at an event needs the history, the same reason a refund stays
    // in BeverageSale rather than being erased.
    cancelledAt: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

HappyHourSchema.index({ event: 1, createdAt: -1 });
HappyHourSchema.index({ venue: 1, createdAt: -1 });
HappyHourSchema.index({ "items.lineup": 1 });

module.exports = mongoose.model("HappyHour", HappyHourSchema);
