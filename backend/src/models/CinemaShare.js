const mongoose = require("mongoose");

// The cinema twin of TicketShare/BeverageShare — see BeverageShare's model
// comment for the reasoning that applies here unchanged (one collection for
// both item kinds, gated by a discriminator, since a share record carries no
// revenue-aggregation risk the way the underlying sale collections do).
//
// FULL-only, unlike the other two: a cinema ticket's seats and a concession
// sale's units don't split the way a multi-admission event ticket or a
// multi-unit drink sale can, so there is no `transferType` enum and no
// `resultingItem` — accepting a share reassigns `customer` on the SAME
// document, and there is never a second document to point at.
const CinemaShareItemSchema = new mongoose.Schema(
  {
    // No `ref`: which collection this points into (CinemaTicket vs
    // CinemaBeverageSale) depends on the parent document's `itemType`, not
    // on the item — resolved by hand in cinemaShareService.js.
    item: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const CinemaShareSchema = new mongoose.Schema(
  {
    // Constant per share — a single hand-off never mixes a ticket with a
    // snack, so this also says which collection every `item` in `items`
    // lives in.
    itemType: {
      type: String,
      enum: ["CINEMA_TICKET", "CINEMA_CONCESSION"],
      required: true,
      index: true,
    },

    items: {
      type: [CinemaShareItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A share needs at least one item",
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
    // next read (see cinemaShareService.expireDueShares), same as the other
    // two share systems.
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

CinemaShareSchema.index({ fromUser: 1, createdAt: -1 });
CinemaShareSchema.index({ toUser: 1, status: 1, createdAt: -1 });
CinemaShareSchema.index({ "items.item": 1 });
CinemaShareSchema.index(
  { fromUser: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("CinemaShare", CinemaShareSchema);
