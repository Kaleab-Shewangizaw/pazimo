const mongoose = require("mongoose");

// One directional edge: "blocker has blocked blocked." Mirrors Contact.js's
// shape exactly — a block only needs to be checked from the blocker's side
// outward (isBlockedEitherWay in blockService.js checks both directions by
// querying this collection twice, the same way mutual-contact status is
// derived from two Contact edges rather than stored as its own flag).
const BlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One edge per (blocker, blocked) pair — blocking the same person twice is a
// no-op, not a duplicate row.
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
// "Who has blocked ME" — the other half of an either-way block check.
BlockSchema.index({ blocked: 1, blocker: 1 });

module.exports = mongoose.model("Block", BlockSchema);
