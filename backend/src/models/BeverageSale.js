const mongoose = require("mongoose");
const { getNextSequence } = require("./Counter");

// The ledger of beverage sales — one row per purchase of one drink at one
// event. This is the source of truth for revenue; EventBeverage.sold is only a
// denormalised counter kept alongside it so stock can be reserved atomically.
//
// Prices and names are snapshotted at the moment of sale on purpose. An
// organizer repricing a drink, or an admin renaming or deleting it from the
// catalogue, must never retroactively change what a past sale was worth or
// what it was called — the same reasoning as Loan.limitAtRequest.
const BeverageSaleSchema = new mongoose.Schema(
  {
    // Human-facing tracking number, e.g. "PZB-SL-000042", assigned once and
    // never reassigned. Mirrors Loan's referenceNumber.
    referenceNumber: {
      type: String,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The line-up row this was bought from. Kept so stock can be returned on
    // refund, even after the drink itself is gone from the catalogue.
    eventBeverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EventBeverage",
      required: true,
    },
    beverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beverage",
      required: true,
    },

    // Snapshots — see the note above.
    beverageName: {
      type: String,
      required: true,
    },
    beverageColor: {
      type: String,
      default: null,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
    },

    // Who bought it. Optional: a guest checkout has no account, and the
    // contact fields below are what a door list would be built from.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },

    // Refunded sales stay in the ledger and are excluded from revenue, rather
    // than being deleted — the history of a refund matters.
    status: {
      type: String,
      enum: ["confirmed", "refunded"],
      default: "confirmed",
    },
    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    refundReason: String,

    // How the sale reached us. "online" is the eventual customer checkout;
    // "manual" is an organizer or admin recording one by hand.
    channel: {
      type: String,
      enum: ["online", "manual"],
      default: "manual",
    },

    soldAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Dashboards read by event, by organizer and by drink, always newest-first and
// almost always filtered to confirmed sales.
BeverageSaleSchema.index({ event: 1, soldAt: -1 });
BeverageSaleSchema.index({ organizer: 1, soldAt: -1 });
BeverageSaleSchema.index({ beverage: 1, soldAt: -1 });
BeverageSaleSchema.index({ status: 1, soldAt: -1 });
BeverageSaleSchema.index({ referenceNumber: 1 }, { unique: true, sparse: true });

// pre-validate rather than pre-save so the value exists before Mongoose runs
// schema validation on a new document.
BeverageSaleSchema.pre("validate", async function assignReferenceNumber(next) {
  if (this.referenceNumber) return next();
  try {
    const seq = await getNextSequence("beverageSale");
    this.referenceNumber = `PZB-SL-${String(seq).padStart(6, "0")}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("BeverageSale", BeverageSaleSchema);
