const mongoose = require("mongoose");
const { getNextSequence } = require("./Counter");
const {
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
  organizerVatRateFor,
} = require("../config/rates");

// The ledger of cinema concession sales — one row per purchase of one product at
// one cinema. Source of truth for cinema concession revenue; CinemaBeverage.sold
// is only a denormalised counter kept alongside it so stock can be reserved
// atomically.
//
// A separate collection from BeverageSale and VenueBeverageSale for the reason
// VenueBeverageSale sets out: those ledgers are read by aggregations that carry
// no ownership filter, so a shared collection would require every existing and
// future call site to remember to exclude cinema rows — or cinema money would
// land in an organizer's balance and be paid out to them. Separate ledgers make
// that impossible to write rather than merely forbidden.
//
// What is NOT duplicated is the money maths: all three channels compute
// commission, VAT and the seller's share through the same expressions in
// utils/beverageRevenueQuery.js.
const CinemaBeverageSaleSchema = new mongoose.Schema(
  {
    // Human-facing tracking number, e.g. "PZC-SL-000042". A distinct prefix from
    // the event ledger's "PZB-SL-" and the venue ledger's "PZV-SL-" so a
    // reference alone identifies which channel — and which collection — a sale
    // belongs to, without a lookup.
    referenceNumber: {
      type: String,
    },

    // The sales context, stated explicitly rather than left implicit in the
    // collection name. Constant by design: a row here is a cinema sale, always.
    salesContext: {
      type: String,
      enum: ["CINEMA"],
      default: "CINEMA",
    },

    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },
    // The line-up row this was bought from. Kept so stock can be returned on
    // refund, even after the product is gone from the catalogue.
    cinemaBeverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaBeverage",
      required: true,
    },
    beverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Beverage",
      required: true,
    },

    // Optional link to the screening this was bought alongside.
    //
    // Nullable on purpose: someone buying popcorn at the counter without a
    // ticket is a normal cinema sale, not an error. When present it lets a
    // cinema see concession revenue per screening, which is the question they
    // actually ask ("did the 8pm show sell drinks?"). It never affects the money
    // split — that is the cinema's rate regardless.
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaShowtime",
    },

    // Snapshots — a cinema repricing a product, or an admin renaming it in the
    // catalogue, must never restate what a past sale was worth or what it was
    // called.
    beverageName: {
      type: String,
      required: true,
    },
    beverageColor: {
      type: String,
      default: null,
    },
    // The catalogue category at time of sale ("drink", "snack", "combo").
    // Snapshotted so a report of "what did we sell" still groups correctly after
    // an admin recategorises a product.
    beverageCategory: {
      type: String,
      default: "drink",
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

    // The commission rate this sale was made under, copied from the cinema at
    // sale time and never rewritten — same reasoning as the other two ledgers.
    commissionRate: {
      type: Number,
      min: 0,
    },

    // The cinema's own VAT withheld on this sale, when Pazimo covers the cinema
    // (Cinema.coversCinemaVat). 0 or absent means the cinema settles its own.
    // A liability Pazimo remits on their behalf, never Pazimo revenue.
    cinemaVatRate: {
      type: Number,
      min: 0,
    },

    // Who bought it. Optional: a walk-in at the counter has no account, which is
    // the normal case for this channel.
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

    // How the sale reached us. "manual" is a cinema operator recording one at
    // the counter; "online" is a customer checkout.
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

    soldAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Dashboards read by cinema, by product and by screening, newest-first, almost
// always filtered to confirmed sales.
CinemaBeverageSaleSchema.index({ cinema: 1, soldAt: -1 });
CinemaBeverageSaleSchema.index({ beverage: 1, soldAt: -1 });
CinemaBeverageSaleSchema.index({ showtime: 1, status: 1 });
CinemaBeverageSaleSchema.index({ status: 1, soldAt: -1 });
CinemaBeverageSaleSchema.index(
  { referenceNumber: 1 },
  { unique: true, sparse: true }
);
// Revenue queries scope by cinema and exclude refunds.
CinemaBeverageSaleSchema.index({ cinema: 1, status: 1, soldAt: -1 });

// Snapshot the cinema's concession commission rate and VAT coverage at sale
// time. In the model rather than the service, so no future sale path can forget
// it. Mirrors the identical hook on BeverageSale and VenueBeverageSale.
CinemaBeverageSaleSchema.pre(
  "validate",
  async function snapshotCommissionRate(next) {
    if (!this.isNew) return next();
    const hasCommission = typeof this.commissionRate === "number";
    const hasCinemaVat = typeof this.cinemaVatRate === "number";
    if (hasCommission && hasCinemaVat) return next();
    if (!this.cinema) return next();

    try {
      const CinemaModel = require("./Cinema");
      const cinema = await CinemaModel.findById(this.cinema)
        .select("beverageCommissionRate coversCinemaVat")
        .lean();
      if (!hasCommission) {
        this.commissionRate = normalizeCommissionRate(
          cinema?.beverageCommissionRate ?? DEFAULT_COMMISSION_RATE
        );
      }
      if (!hasCinemaVat) {
        this.cinemaVatRate = organizerVatRateFor(cinema?.coversCinemaVat);
      }
      next();
    } catch (error) {
      // Never block a paid sale on a pricing lookup — fall back to the same
      // defaults a reader would have assumed.
      console.error(
        "Cinema beverage commission snapshot failed, using default:",
        error.message
      );
      if (!hasCommission) this.commissionRate = DEFAULT_COMMISSION_RATE;
      if (!hasCinemaVat) this.cinemaVatRate = 0;
      next();
    }
  }
);

// pre-validate rather than pre-save so the value exists before Mongoose runs
// schema validation on a new document.
CinemaBeverageSaleSchema.pre(
  "validate",
  async function assignReferenceNumber(next) {
    if (this.referenceNumber) return next();
    try {
      const seq = await getNextSequence("cinemaBeverageSale");
      this.referenceNumber = `PZC-SL-${String(seq).padStart(6, "0")}`;
      next();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = mongoose.model("CinemaBeverageSale", CinemaBeverageSaleSchema);
