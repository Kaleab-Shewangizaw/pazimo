const mongoose = require("mongoose");
const { getNextSequence } = require("./Counter");
const {
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
  organizerVatRateFor,
} = require("../config/rates");

// The ledger of venue beverage sales — one row per purchase of one drink at one
// venue. Source of truth for venue revenue; VenueBeverage.sold is only a
// denormalised counter kept alongside it so stock can be reserved atomically.
//
// WHY THIS IS A SEPARATE COLLECTION FROM BeverageSale
//
// The two ledgers could have shared one collection behind a salesContext
// discriminator. They deliberately do not, because BeverageSale is read by
// aggregations that carry no ownership filter at all — getAdminBeverageFinance
// matches nothing but `validBeverageSaleMatch("ETB")`, and financeService sums a
// whole organizer's drink revenue. In a shared collection every one of those
// call sites, and every future one, would have to remember to exclude venue
// rows or venue money would silently land in an organizer's balance and be paid
// out to them.
//
// A separate collection makes that class of mistake impossible to write rather
// than merely forbidden. What is NOT duplicated is the money maths: both
// channels compute commission, VAT and the owner's share through the same
// expressions in utils/beverageRevenueQuery.js. Separate ledgers, shared
// machinery — the same rule Withdrawal.stream follows on the payout side.
//
// Prices and names are snapshotted at the moment of sale for the same reason
// BeverageSale does it: a venue repricing a drink, or an admin renaming it in
// the catalogue, must never restate what a past sale was worth.
const VenueBeverageSaleSchema = new mongoose.Schema(
  {
    // Human-facing tracking number, e.g. "PZV-SL-000042", assigned once and
    // never reassigned. A distinct prefix from the event ledger's "PZB-SL-" so a
    // reference alone identifies which channel — and which collection — a sale
    // belongs to, without a lookup.
    referenceNumber: {
      type: String,
    },

    // The sales context, stated explicitly rather than left implicit in the
    // collection name. Admin screens merge both ledgers into one feed, and every
    // row in that feed has to be able to say which channel produced it. Constant
    // by design: a row in this collection is a venue sale, always.
    salesContext: {
      type: String,
      enum: ["VENUE"],
      default: "VENUE",
    },

    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    // The line-up row this was bought from. Kept so stock can be returned on
    // refund, even after the drink itself is gone from the catalogue.
    venueBeverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VenueBeverage",
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

    // The commission rate this sale was made under, copied from the venue at
    // sale time and never rewritten — same reasoning as BeverageSale's snapshot.
    // Renegotiating a venue's cut must not restate revenue already reported.
    commissionRate: {
      type: Number,
      min: 0,
    },

    // The venue's own VAT withheld on this sale, when Pazimo covers the venue
    // (Venue.coversVenueVat). 0 or absent means the venue settles its own.
    //
    // A liability Pazimo remits on the venue's behalf, never Pazimo revenue.
    venueVatRate: {
      type: Number,
      min: 0,
    },

    // Who bought it. Optional: a walk-in at a bar has no account, which is the
    // normal case for this channel rather than the exception it is for events.
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

    // How the sale reached us. "manual" is a venue operator recording one at the
    // counter; "online" is a customer checkout.
    channel: {
      type: String,
      enum: ["online", "manual"],
      default: "manual",
    },

    // Ties an online sale back to the payment that funded it, so it can be
    // reconciled against the transaction and refunded if the order is reversed.
    paymentReference: {
      type: String,
      index: true,
      sparse: true,
    },

    // --- Collection at the counter -----------------------------------------
    //
    // A sale recorded manually by venue staff is handed over as it is rung up,
    // so it needs no record of collection. A sale bought online (through the
    // mobile app's "refill" checkout) is a promise: the customer has paid and
    // shows their order at the counter to collect it. Without a record of
    // that handover there is nothing to stop the same drink being claimed
    // twice. Mirrors CinemaBeverageSale exactly.
    redeemedAt: Date,
    redeemedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Set while a BeverageShare transfer of this sale is outstanding. Mirrors
    // BeverageSale.pendingShare exactly — see there for why.
    pendingShare: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BeverageShare",
      default: null,
    },

    soldAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * "Still owed to this customer", as a query filter — one definition, shared by
 * the venue counter lookup and the redeem endpoint. `redeemedAt: null` matches
 * an absent field as well as an explicit null, so rows written before
 * redemption existed are correctly outstanding.
 */
VenueBeverageSaleSchema.statics.OUTSTANDING = {
  channel: "online",
  status: "confirmed",
  redeemedAt: null,
  pendingShare: null,
};

// Dashboards read by venue and by drink, newest-first, almost always filtered to
// confirmed sales.
VenueBeverageSaleSchema.index({ venue: 1, soldAt: -1 });
VenueBeverageSaleSchema.index({ beverage: 1, soldAt: -1 });
VenueBeverageSaleSchema.index({ status: 1, soldAt: -1 });
VenueBeverageSaleSchema.index({ referenceNumber: 1 }, { unique: true, sparse: true });
// Revenue queries scope by venue and exclude refunds.
VenueBeverageSaleSchema.index({ venue: 1, status: 1, soldAt: -1 });

// Snapshot the venue's commission rate and VAT coverage at the moment of sale.
//
// In the model rather than in the service, so no future sale path — a checkout
// basket, an import, a backfill — can forget it. Mirrors the identical hook on
// BeverageSale.
VenueBeverageSaleSchema.pre("validate", async function snapshotCommissionRate(next) {
  if (!this.isNew) return next();
  const hasCommission = typeof this.commissionRate === "number";
  const hasVenueVat = typeof this.venueVatRate === "number";
  if (hasCommission && hasVenueVat) return next();
  if (!this.venue) return next();

  try {
    const VenueModel = require("./Venue");
    const venue = await VenueModel.findById(this.venue)
      .select("beverageCommissionRate coversVenueVat")
      .lean();
    if (!hasCommission) {
      this.commissionRate = normalizeCommissionRate(
        venue?.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
      );
    }
    if (!hasVenueVat) {
      this.venueVatRate = organizerVatRateFor(venue?.coversVenueVat);
    }
    next();
  } catch (error) {
    // Never block a paid sale on a pricing lookup — fall back to the same
    // defaults a reader would have assumed.
    console.error(
      "Venue beverage commission snapshot failed, using default:",
      error.message
    );
    if (!hasCommission) this.commissionRate = DEFAULT_COMMISSION_RATE;
    if (!hasVenueVat) this.venueVatRate = 0;
    next();
  }
});

// pre-validate rather than pre-save so the value exists before Mongoose runs
// schema validation on a new document.
VenueBeverageSaleSchema.pre("validate", async function assignReferenceNumber(next) {
  if (this.referenceNumber) return next();
  try {
    const seq = await getNextSequence("venueBeverageSale");
    this.referenceNumber = `PZV-SL-${String(seq).padStart(6, "0")}`;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("VenueBeverageSale", VenueBeverageSaleSchema);
