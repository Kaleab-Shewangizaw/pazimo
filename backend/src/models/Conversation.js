const mongoose = require("mongoose");

// One row per pair of users who have ever exchanged a message or a
// ticket/drink/cinema share — the backend-authoritative source for the chat
// list, replacing what used to be derived client-side by grouping flat share
// records per counterparty. That trick worked while transfers were the only
// activity (infrequent); a real chat needs an efficient "my conversations,
// newest first" query, which a from-scratch aggregation over three
// collections cannot give cheaply at any real message volume.
//
// 1:1 only — `participants` is always exactly two ids. No group-chat concept
// exists yet; extending to more than two participants later is a real schema
// change (uniqueness semantics, `pairKey` construction), not a field
// addition.
const ConversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "A conversation has exactly two participants",
      },
    },

    // The actual uniqueness key: a deterministic scalar for the unordered
    // pair (`[idA, idB].sort().join(":")`), not the `participants` array
    // itself. A `unique` index directly on `participants` would be a
    // MULTIKEY index, which enforces uniqueness per array ELEMENT — it would
    // make it impossible for the same user to appear in more than one
    // conversation at all. `pairKey` sidesteps that entirely.
    pairKey: {
      type: String,
      required: true,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Already-composed display copy ("🎟️ Ticket sent", the message text
    // itself, ...) — generated once, server-side, at write time, so every
    // client (this app, any future one) shows the same chat-list preview
    // without reimplementing the copy table.
    lastMessagePreview: {
      type: String,
      maxlength: 140,
    },
    lastMessageSender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessageKind: {
      type: String,
      enum: ["MESSAGE", "TICKET", "BEVERAGE", "CINEMA_TICKET", "CINEMA_CONCESSION"],
    },
    // Only set when `lastMessageKind === "MESSAGE"` — points at the actual
    // `Message` document so an edit/delete of it can tell whether it's the
    // one currently driving the chat-list preview and needs to refresh it.
    // Shares never set this (there's no `Message` row to point at).
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // "Delete chat" is per-user and non-destructive, same posture as a
    // message's own `deletedAt` — it never touches the other participant's
    // copy or the underlying `Message` rows. Keyed by user id (as a string,
    // since Map keys must be strings): `listMessages`/
    // `listConversationsForUser` hide anything at or before this person's
    // own timestamp, and new activity past it makes the conversation
    // reappear for them on its own, the same way a cleared WhatsApp chat
    // does.
    clearedAt: {
      type: Map,
      of: Date,
    },
  },
  { timestamps: true }
);

// The chat-list query: every conversation I'm in, newest activity first.
ConversationSchema.index({ participants: 1, lastMessageAt: -1 });
// The actual dedupe constraint — one conversation per unordered pair.
ConversationSchema.index({ pairKey: 1 }, { unique: true });

module.exports = mongoose.model("Conversation", ConversationSchema);
