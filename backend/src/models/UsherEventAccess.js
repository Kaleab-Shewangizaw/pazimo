const mongoose = require("mongoose");

// Created when an usher redeems an EventUsherCode (see usherController.unlockEvent).
// Persists until explicitly revoked by the event's organizer or an admin —
// rotating the event's code afterwards does not touch grants already made
// under an earlier code, and scanning authorization (ticketController's
// checkInTicket/validateQRCode) checks this collection, never the code
// itself, on every scan.
//
// An usher holds at most one live (revokedAt: null) grant at a time —
// redeeming a different event's code revokes whatever was live before
// creating the new one (see unlockEvent), so scanning is always scoped to
// exactly one event, never several concurrently. Enforced there in
// application code; the partial unique index below is the same rule as a
// database-level backstop.
const UsherEventAccessSchema = new mongoose.Schema(
  {
    usher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
    // null while the grant is active. Set (never deleted) on revoke so the
    // event's usher history stays auditable instead of just disappearing.
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One grant document per (usher, event) pair — redeeming the same event's
// code twice, or re-redeeming after a revoke, updates this row in place
// rather than accumulating duplicates (see unlockEvent's upsert).
UsherEventAccessSchema.index({ usher: 1, event: 1 }, { unique: true });
// Scanning authorization's actual lookup shape: "does this usher currently
// have a live grant for this event".
UsherEventAccessSchema.index({ event: 1, usher: 1, revokedAt: 1 });
// Backstop for "at most one live grant per usher" — a partial index only
// covers documents where revokedAt is null, so past (revoked) grants for
// other events never collide with it.
UsherEventAccessSchema.index(
  { usher: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);

module.exports = mongoose.model("UsherEventAccess", UsherEventAccessSchema);
