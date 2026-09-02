const mongoose = require("mongoose");

// One share action can move several of the sender's tickets to one recipient
// at once (e.g. "send 2 of my 5 tickets to Abel"), which is why `tickets` is
// an array rather than a single ref.
//
// A share does not move ownership by itself — it sits `pending` until the
// recipient accepts it (see Ticket.pendingShare, which locks each ticket
// against reuse/check-in/re-sharing while a share on it is outstanding).
// Declining, cancelling, or letting it expire unclaimed all leave the
// tickets with the sender, untouched.
const TicketShareSchema = new mongoose.Schema(
  {
    tickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
        required: true,
      },
    ],

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
  },
  { timestamps: true }
);

TicketShareSchema.index({ fromUser: 1, createdAt: -1 });
TicketShareSchema.index({ toUser: 1, status: 1, createdAt: -1 });
TicketShareSchema.index({ tickets: 1 });

module.exports = mongoose.model("TicketShare", TicketShareSchema);
