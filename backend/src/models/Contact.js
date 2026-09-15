const mongoose = require("mongoose");

// One directional edge: "owner has added contact to their contacts." Mutual
// contact status (used to gate phone-number visibility in a chat's contact
// card — see conversationController.js's getContactCard) is derived by
// checking both directions exist, not stored as its own flag, so the two
// edges can never disagree with each other about being "mutual."
const ContactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One edge per (owner, contact) pair — adding the same person twice is a
// no-op, not a duplicate row.
ContactSchema.index({ owner: 1, contact: 1 }, { unique: true });
// "Who has added ME" — the other half of a mutual-contact check.
ContactSchema.index({ contact: 1, owner: 1 });

module.exports = mongoose.model("Contact", ContactSchema);
