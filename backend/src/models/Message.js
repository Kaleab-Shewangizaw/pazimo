const mongoose = require("mongoose");

// A single free-text chat message between two users. The sender may edit or
// (soft-)delete their own message afterward — `editedAt`/`deletedAt` record
// that without keeping a full revision history, which nothing needs yet.
const MessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Denormalized even though it's implied by `conversation.participants` —
    // matches the `fromUser`/`toUser` convention every share model already
    // uses, and keeps `notifyUser`'s recipient-room targeting a plain field
    // read rather than a second lookup.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // Schema-ready for read receipts; nothing sets this yet and no
    // `message:read` event exists this pass — deliberately scoped out, not
    // forgotten. Adding that behavior later needs no migration.
    readAt: {
      type: Date,
      default: null,
    },
    // Set when the sender edits the text after sending. `null` means never edited.
    editedAt: {
      type: Date,
      default: null,
    },
    // Soft delete — kept for referential/audit purposes rather than removed,
    // matching the rest of this codebase's "never actually delete a record"
    // posture. Any read path must treat a deleted message's `text` as gone.
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Cursor pagination within one conversation, newest first.
MessageSchema.index({ conversation: 1, _id: -1 });

module.exports = mongoose.model("Message", MessageSchema);
