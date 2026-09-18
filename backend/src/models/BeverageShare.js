const mongoose = require("mongoose");

// The drinks twin of TicketShare — see that model for the full reasoning,
// which applies here unchanged. The differences are only where the two
// domains genuinely differ:
//
//   - A single collection serves BOTH the event and venue channels (unlike
//     BeverageSale/VenueBeverageSale, which are deliberately separate so
//     revenue aggregations can never mix them by forgetting a filter). A
//     transfer record carries no revenue-aggregation risk — nothing sums
//     money out of this collection — so one shape, gated by `salesContext`,
//     is simpler than two near-identical models.
//   - `items[].sale`/`resultingSale` carry no schema `ref`: which collection
//     they point into (BeverageSale vs VenueBeverageSale) depends on this
//     document's own `salesContext`, not on the item, so
//     beverageShareService resolves and populates them by hand rather than
//     via Mongoose's static `ref`/`refPath`.
//   - Quantity is simpler to split than a ticket's: `unitPrice` on a
//     BeverageSale/VenueBeverageSale is already per-unit, so a split child's
//     `totalAmount` is exactly `round2(unitPrice * quantity)` with no
//     rounding-remainder trick needed (see ticketShareService's
//     childPrice/remainingPrice comment for the harder case this avoids).
const BeverageShareItemSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    transferType: {
      type: String,
      enum: ["FULL", "PARTIAL"],
      required: true,
    },
    // Set on accept: the sale row toUser actually holds afterwards — the
    // same document as `sale` for FULL, or the newly split child for
    // PARTIAL. Same meaning as TicketShareItem.resultingTicket.
    resultingSale: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: false }
);

const BeverageShareSchema = new mongoose.Schema(
  {
    // Constant per share — a single hand-off never mixes an event drink with
    // a venue drink, so this also says which collection every `sale`/
    // `resultingSale` in `items` lives in.
    salesContext: {
      type: String,
      enum: ["EVENT_BEVERAGE", "VENUE_BEVERAGE"],
      required: true,
      index: true,
    },

    items: {
      type: [BeverageShareItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A share needs at least one drink item",
      },
    },

    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "expired"],
      default: "pending",
      index: true,
    },

    respondedAt: {
      type: Date,
    },

    // A pending share left unclaimed past this date is treated as expired on
    // next read (see beverageShareService.expireDueShares), same as
    // TicketShare.
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Client-supplied dedupe token — same purpose as TicketShare's.
    idempotencyKey: {
      type: String,
    },
  },
  { timestamps: true }
);

BeverageShareSchema.index({ fromUser: 1, createdAt: -1 });
BeverageShareSchema.index({ toUser: 1, status: 1, createdAt: -1 });
BeverageShareSchema.index({ "items.sale": 1 });
BeverageShareSchema.index(
  { fromUser: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("BeverageShare", BeverageShareSchema);
