const mongoose = require("mongoose");

// One share action can move admissions from several of the sender's tickets
// to one recipient at once (e.g. "send 2 of my 5 tickets to Abel"), which is
// why `items` is an array rather than a single ref.
//
// Each item is a slice of one source ticket's *remaining* capacity
// (Ticket.ticketCount — admissions not yet checked in), not the ticket as a
// whole:
//   - FULL   quantity === the ticket's ticketCount at share-creation time.
//            On accept, that ticket's ownership itself moves to toUser.
//   - PARTIAL quantity < ticketCount. On accept, the source ticket keeps
//            (ticketCount - quantity) and a brand-new child Ticket is
//            created for toUser with `quantity` — see
//            ticketShareService.respondToShare and Ticket.parentTicketId/
//            rootTicketId. `resultingTicket` records which ticket the
//            recipient actually ended up with (only known once accepted).
//
// A share does not move ownership by itself — it sits `pending` until the
// recipient accepts it (see Ticket.pendingShare, which locks each source
// ticket against reuse/check-in/re-sharing while a share on it is
// outstanding). Declining, cancelling, or letting it expire unclaimed all
// leave the source tickets with the sender, untouched. This is also why
// FULL vs PARTIAL can be decided at creation time and trusted at accept
// time: while pendingShare is set, checkInTicket/cancelTicket both refuse to
// touch the ticket, so its ticketCount cannot drift in between.
const TicketShareItemSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
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
    // Set on accept: the ticket toUser actually holds afterwards — the same
    // document as `ticket` for FULL, or the newly split child for PARTIAL.
    resultingTicket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ticket",
      default: null,
    },
  },
  { _id: false }
);

const TicketShareSchema = new mongoose.Schema(
  {
    items: {
      type: [TicketShareItemSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "A share needs at least one ticket item",
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
    // next read (see ticketShareService.expireDueShares) rather than deleted,
    // so it still shows up in share history.
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Client-supplied dedupe token (see ticketShareService.createShare):
    // a retried POST (double tap, network retry, WebSocket-reconnect resend)
    // carrying the same key returns the original share instead of creating a
    // second one. Sparse + scoped to fromUser so two different senders can't
    // collide on a coincidentally-equal key.
    idempotencyKey: {
      type: String,
    },
  },
  { timestamps: true }
);

TicketShareSchema.index({ fromUser: 1, createdAt: -1 });
TicketShareSchema.index({ toUser: 1, status: 1, createdAt: -1 });
TicketShareSchema.index({ "items.ticket": 1 });
TicketShareSchema.index(
  { fromUser: 1, idempotencyKey: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("TicketShare", TicketShareSchema);
