const mongoose = require("mongoose");
const { getNextSequence } = require("./Counter");
const {
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
  organizerVatRateFor,
} = require("../config/rates");

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

    // The sales context this row belongs to. Constant by design: a row in this
    // collection is an event sale, always — venue sales live in their own
    // ledger (see VenueBeverageSale for why they are not folded in here).
    //
    // It is stored rather than inferred because admin screens merge both
    // ledgers into one feed, and every row in that feed has to state which
    // channel produced it. Rows written before the venue channel existed carry
    // no value; readers treat absent as "EVENT", which is what they were.
    salesContext: {
      type: String,
      enum: ["EVENT"],
      default: "EVENT",
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

    // The commission rate this sale was made under, copied from the event at
    // sale time and never rewritten — same reasoning as the unitPrice snapshot
    // above and Ticket.commissionRate. Renegotiating an event's bar cut must
    // not restate drink revenue that has already been reported or paid out.
    //
    // Absent on sales made before beverage commission existed; readers fall
    // back to the 3% default (see utils/beverageRevenueQuery.js).
    commissionRate: {
      type: Number,
      min: 0,
    },

    // The organizer's own VAT withheld on this sale, when Pazimo covers the
    // event (Event.coversOrganizerVat). Coverage is a property of the event,
    // not of the stream, so a covered event withholds it on drinks exactly as
    // it does on tickets. 0 or absent means the organizer settles their own.
    organizerVatRate: {
      type: Number,
      min: 0,
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

    // Ties an online sale back to the payment that funded it, so a basket
    // bought during ticket checkout can be reconciled against the transaction
    // and refunded alongside the ticket if the whole order is reversed.
    paymentReference: {
      type: String,
      index: true,
      sparse: true,
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
// Revenue queries scope by organizer or event and exclude refunds.
BeverageSaleSchema.index({ organizer: 1, status: 1, soldAt: -1 });
BeverageSaleSchema.index({ event: 1, status: 1 });

// Snapshot the beverage commission rate and VAT coverage at the moment of sale.
//
// In the model rather than in beverageSalesService, so any future sale path —
// the checkout basket in B2, an import, a backfill — cannot forget it.
BeverageSaleSchema.pre("validate", async function snapshotCommissionRate(next) {
  if (!this.isNew) return next();
  const hasCommission = typeof this.commissionRate === "number";
  const hasOrganizerVat = typeof this.organizerVatRate === "number";
  if (hasCommission && hasOrganizerVat) return next();
  if (!this.event) return next();

  try {
    const EventModel = require("./Event");
    const event = await EventModel.findById(this.event)
      .select("beverageCommissionRate coversOrganizerVat")
      .lean();
    if (!hasCommission) {
      this.commissionRate = normalizeCommissionRate(
        event?.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
      );
    }
    if (!hasOrganizerVat) {
      this.organizerVatRate = organizerVatRateFor(event?.coversOrganizerVat);
    }
    next();
  } catch (error) {
    // Never block a paid sale on a pricing lookup — fall back to the same
    // defaults a reader would have assumed.
    console.error("Beverage commission snapshot failed, using default:", error.message);
    if (!hasCommission) this.commissionRate = DEFAULT_COMMISSION_RATE;
    if (!hasOrganizerVat) this.organizerVatRate = 0;
    next();
  }
});

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
