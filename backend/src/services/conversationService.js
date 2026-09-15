const mongoose = require("mongoose");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../errors");
const { isBlockedEitherWay } = require("./blockService");

// The one place that knows what a "conversation" is. Depended on BY the
// three share services (ticketShareService.js/beverageShareService.js/
// cinemaShareService.js) rather than the other way around — same direction
// beverageShareService.js/cinemaShareService.js already depend on
// ticketShareService.js for `searchRecipients`, just one level further out,
// so there is no require cycle.

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const pairKeyFor = (userAId, userBId) =>
  [String(userAId), String(userBId)].sort().join(":");

/**
 * Upserts a conversation's `lastMessage*` fields — called on every new
 * message AND on every new ticket/drink/cinema share, so the chat list
 * surfaces a counterparty even if the two people never exchange a word.
 * Atomic: `pairKey`'s unique index means two concurrent first-contacts
 * between the same pair can never create two documents.
 */
const touchConversation = async ({ userAId, userBId, senderId, preview, kind, at, messageId }) => {
  const pairKey = pairKeyFor(userAId, userBId);
  return Conversation.findOneAndUpdate(
    { pairKey },
    {
      $set: {
        lastMessageAt: at || new Date(),
        lastMessagePreview: preview,
        lastMessageSender: senderId,
        lastMessageKind: kind,
        // A share touch has no `Message` row to point at — explicitly null
        // it out rather than leaving a stale id from a prior text message.
        lastMessage: messageId || null,
      },
      $setOnInsert: { participants: [userAId, userBId], pairKey },
    },
    { upsert: true, new: true }
  );
};

/** Same upsert, without touching `lastMessage*` — just resolves (or creates) the conversation id a new Message needs to point at. */
const getOrCreateConversation = async ({ userAId, userBId }) => {
  const pairKey = pairKeyFor(userAId, userBId);
  return Conversation.findOneAndUpdate(
    { pairKey },
    { $setOnInsert: { participants: [userAId, userBId], pairKey } },
    { upsert: true, new: true }
  );
};

const messagePopulate = [
  { path: "sender", select: "firstName lastName username" },
  { path: "recipient", select: "firstName lastName username" },
];

/**
 * The shape every read path returns — never the raw document. Callers only
 * ever pass a live (non-deleted) message in: a deleted one is filtered out
 * of `listMessages` entirely and can't be re-fetched by id, so there's no
 * "this message was deleted" state to represent here at all — the other
 * person just never knows it existed.
 */
const toClientMessage = (message) => ({
  _id: message._id,
  conversation: message.conversation,
  sender: message.sender,
  recipient: message.recipient,
  text: message.text,
  createdAt: message.createdAt,
  readAt: message.readAt || null,
  editedAt: message.editedAt || null,
});

/** The chat list — every conversation this account is in, newest activity first. */
const listConversationsForUser = async ({ userId }) => {
  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .populate("participants", "firstName lastName username")
    .lean();

  return conversations
    .filter((conversation) => {
      // `.lean()` gives back the Map as a plain object, not a Map instance.
      const clearedAt = conversation.clearedAt && conversation.clearedAt[String(userId)];
      if (!clearedAt) return true;
      // Nothing has happened since this person cleared it — stays hidden
      // from their list until fresh activity touches `lastMessageAt` again.
      return new Date(conversation.lastMessageAt) > new Date(clearedAt);
    })
    .map((conversation) => {
      const counterparty = conversation.participants.find(
        (p) => String(p._id) !== String(userId)
      );
      return {
        _id: conversation._id,
        counterparty,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageSenderId: conversation.lastMessageSender,
        lastMessageKind: conversation.lastMessageKind,
      };
    });
};

const MAX_MESSAGES_PAGE = 50;
const DEFAULT_MESSAGES_PAGE = 30;

/** Cursor-paginated history with one counterparty, newest-first per page. */
const listMessages = async ({ userId, counterpartyId, before, limit }) => {
  if (!isValidId(counterpartyId)) throw new NotFoundError("Conversation not found");

  const conversation = await Conversation.findOne({
    pairKey: pairKeyFor(userId, counterpartyId),
  }).select("_id clearedAt");

  // No conversation yet — a brand-new thread has nothing to page through,
  // not an error.
  if (!conversation) return { messages: [], nextCursor: null };

  // A deleted message is excluded here, not just text-blanked — this is the
  // one place that decides a deleted message vanishes from history entirely,
  // for both people, with nothing marking the gap.
  const filter = { conversation: conversation._id, deletedAt: null };

  // This user cleared the chat at some point — anything from before that
  // stays hidden from them specifically; the other participant's view (and
  // the messages themselves) are untouched.
  const clearedAt = conversation.clearedAt && conversation.clearedAt.get(String(userId));
  if (clearedAt) {
    filter.createdAt = { $gt: clearedAt };
  }

  if (before) {
    if (!isValidId(before)) throw new BadRequestError("Invalid pagination cursor");
    filter._id = { $lt: before };
  }

  const pageSize = Math.min(Math.max(Number(limit) || DEFAULT_MESSAGES_PAGE, 1), MAX_MESSAGES_PAGE);

  const messages = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(pageSize)
    .populate(messagePopulate)
    .lean();

  const nextCursor = messages.length === pageSize ? messages[messages.length - 1]._id : null;

  return { messages: messages.map(toClientMessage), nextCursor };
};

/** Send a message, lazily creating the conversation on the very first one between this pair. */
const sendMessage = async ({ senderId, recipientId, text }) => {
  if (!isValidId(recipientId)) {
    throw new BadRequestError("A valid recipient is required");
  }
  if (String(recipientId) === String(senderId)) {
    throw new BadRequestError("You can't message yourself");
  }

  const trimmed = String(text || "").trim();
  if (!trimmed) throw new BadRequestError("Message can't be empty");
  if (trimmed.length > 2000) {
    throw new BadRequestError("Message is too long (2000 characters max)");
  }

  const recipient = await User.findOne({
    _id: recipientId,
    isActive: true,
    isBanned: false,
  }).select("_id");
  if (!recipient) throw new NotFoundError("Recipient not found");

  if (await isBlockedEitherWay({ a: senderId, b: recipientId })) {
    throw new ForbiddenError("You can't message this person");
  }

  const conversation = await getOrCreateConversation({
    userAId: senderId,
    userBId: recipientId,
  });

  const created = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    recipient: recipientId,
    text: trimmed,
  });

  await touchConversation({
    userAId: senderId,
    userBId: recipientId,
    senderId,
    preview: trimmed.slice(0, 140),
    kind: "MESSAGE",
    at: created.createdAt,
    messageId: created._id,
  });

  const populated = await Message.findById(created._id).populate(messagePopulate).lean();
  return toClientMessage(populated);
};

/**
 * Refreshes a conversation's list preview after its current `lastMessage`
 * was edited or deleted — a no-op if that message isn't the one actually
 * driving the preview (an older message being deleted never touches it).
 */
const refreshPreviewIfCurrent = async ({ conversation, messageId }) => {
  if (!conversation.lastMessage || String(conversation.lastMessage) !== String(messageId)) {
    return;
  }

  const latest = await Message.findOne({ conversation: conversation._id, deletedAt: null })
    .sort({ _id: -1 })
    .select("_id text sender createdAt");

  if (latest) {
    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: latest._id,
          lastMessageAt: latest.createdAt,
          lastMessagePreview: latest.text.slice(0, 140),
          lastMessageSender: latest.sender,
          lastMessageKind: "MESSAGE",
        },
      }
    );
  } else {
    // Nothing left to show — clear the pointer rather than fabricate a
    // fallback preview; the empty string reads fine as "no messages yet".
    await Conversation.updateOne(
      { _id: conversation._id },
      { $set: { lastMessage: null, lastMessagePreview: "" } }
    );
  }
};

const loadOwnMessage = async ({ userId, counterpartyId, messageId }) => {
  if (!isValidId(counterpartyId) || !isValidId(messageId)) {
    throw new NotFoundError("Message not found");
  }

  const conversation = await Conversation.findOne({
    pairKey: pairKeyFor(userId, counterpartyId),
  });
  if (!conversation) throw new NotFoundError("Message not found");

  const message = await Message.findOne({ _id: messageId, conversation: conversation._id });
  if (!message || message.deletedAt) throw new NotFoundError("Message not found");
  if (String(message.sender) !== String(userId)) {
    throw new ForbiddenError("You can only change your own messages");
  }

  return { conversation, message };
};

/** Edit the sender's own message text. Only the sender may edit; a deleted message can't be edited. */
const editMessage = async ({ userId, counterpartyId, messageId, text }) => {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new BadRequestError("Message can't be empty");
  if (trimmed.length > 2000) {
    throw new BadRequestError("Message is too long (2000 characters max)");
  }

  const { conversation, message } = await loadOwnMessage({ userId, counterpartyId, messageId });

  message.text = trimmed;
  message.editedAt = new Date();
  await message.save();

  await refreshPreviewIfCurrent({ conversation, messageId: message._id });

  const populated = await Message.findById(message._id).populate(messagePopulate).lean();
  return toClientMessage(populated);
};

/**
 * Soft-delete the sender's own message — kept in the database for audit
 * purposes only (matching this codebase's "never truly delete a record"
 * posture elsewhere), but `listMessages`'s `deletedAt: null` filter means it
 * never comes back through any endpoint again. The response is just the id:
 * there is no "deleted" message shape to hand back, on purpose.
 */
const deleteMessage = async ({ userId, counterpartyId, messageId }) => {
  const { conversation, message } = await loadOwnMessage({ userId, counterpartyId, messageId });

  message.deletedAt = new Date();
  await message.save();

  await refreshPreviewIfCurrent({ conversation, messageId: message._id });

  return { _id: message._id };
};

/**
 * "Delete chat" — hides this person's entire history with the counterparty,
 * for them only. Nothing is removed: the other participant's copy, and every
 * underlying `Message` row, are untouched, exactly like a per-message delete
 * already is. A no-op (not an error) when there's no conversation yet, since
 * the end state — nothing to see — is the same either way.
 */
const clearConversation = async ({ userId, counterpartyId }) => {
  if (!isValidId(counterpartyId)) throw new NotFoundError("Conversation not found");

  const conversation = await Conversation.findOne({
    pairKey: pairKeyFor(userId, counterpartyId),
  });
  if (!conversation) return;

  if (!conversation.clearedAt) conversation.clearedAt = new Map();
  conversation.clearedAt.set(String(userId), new Date());
  await conversation.save();
};

module.exports = {
  touchConversation,
  getOrCreateConversation,
  listConversationsForUser,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  clearConversation,
};
