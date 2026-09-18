const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const conversationService = require("../services/conversationService");
const contactService = require("../services/contactService");
const blockService = require("../services/blockService");
const pushService = require("../services/pushService");

const requireUserId = (req) => {
  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }
  return req.user.userId;
};

// Same best-effort pattern as every share controller's notifyUser — a failed
// emit must never fail the HTTP request that triggered it.
const notifyUser = (req, userId, event, payload) => {
  try {
    const io = req.app.get("io");
    if (io) {
      io.to(`user_${userId}`).emit(event, payload);
    }
  } catch (error) {
    console.error(`Failed to emit ${event} to user ${userId}:`, error.message);
  }
};

const nameOf = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
  (user?.username ? `@${user.username}` : "Someone");

const listConversations = async (req, res) => {
  const userId = requireUserId(req);
  const conversations = await conversationService.listConversationsForUser({ userId });
  res.status(StatusCodes.OK).json({ success: true, data: conversations });
};

const listMessages = async (req, res) => {
  const userId = requireUserId(req);
  const { counterpartyId } = req.params;
  const { before, limit } = req.query;

  const result = await conversationService.listMessages({
    userId,
    counterpartyId,
    before,
    limit,
  });

  res.status(StatusCodes.OK).json({ success: true, data: result });
};

const sendMessage = async (req, res) => {
  const senderId = requireUserId(req);
  const { counterpartyId } = req.params;
  const { text } = req.body || {};

  const message = await conversationService.sendMessage({
    senderId,
    recipientId: counterpartyId,
    text,
  });

  const recipientId = message.recipient._id || message.recipient;
  notifyUser(req, recipientId, "message:new", message);
  pushService.sendPushToUser({
    userId: recipientId,
    preferenceKey: "chatMessages",
    title: nameOf(message.sender),
    body: message.text,
    data: { type: "message", counterpartyId: senderId },
  });

  res.status(StatusCodes.CREATED).json({ success: true, data: message });
};

const editMessage = async (req, res) => {
  const userId = requireUserId(req);
  const { counterpartyId, messageId } = req.params;
  const { text } = req.body || {};

  const message = await conversationService.editMessage({ userId, counterpartyId, messageId, text });
  notifyUser(req, counterpartyId, "message:updated", message);

  res.status(StatusCodes.OK).json({ success: true, data: message });
};

const deleteMessage = async (req, res) => {
  const userId = requireUserId(req);
  const { counterpartyId, messageId } = req.params;

  const message = await conversationService.deleteMessage({ userId, counterpartyId, messageId });
  notifyUser(req, counterpartyId, "message:deleted", message);

  res.status(StatusCodes.OK).json({ success: true, data: message });
};

const getContactCard = async (req, res) => {
  const viewerId = requireUserId(req);
  const { counterpartyId } = req.params;

  const card = await contactService.getContactCard({ viewerId, personId: counterpartyId });
  res.status(StatusCodes.OK).json({ success: true, data: card });
};

const addContact = async (req, res) => {
  const ownerId = requireUserId(req);
  const { counterpartyId } = req.params;

  await contactService.addContact({ ownerId, contactId: counterpartyId });
  const card = await contactService.getContactCard({ viewerId: ownerId, personId: counterpartyId });
  res.status(StatusCodes.OK).json({ success: true, data: card });
};

const removeContact = async (req, res) => {
  const ownerId = requireUserId(req);
  const { counterpartyId } = req.params;

  await contactService.removeContact({ ownerId, contactId: counterpartyId });
  const card = await contactService.getContactCard({ viewerId: ownerId, personId: counterpartyId });
  res.status(StatusCodes.OK).json({ success: true, data: card });
};

const listContacts = async (req, res) => {
  const ownerId = requireUserId(req);
  const contacts = await contactService.listContacts({ ownerId });
  res.status(StatusCodes.OK).json({ success: true, data: contacts });
};

const listBlocked = async (req, res) => {
  const blockerId = requireUserId(req);
  const blocked = await blockService.listBlocked({ blockerId });
  res.status(StatusCodes.OK).json({ success: true, data: blocked });
};

const blockUser = async (req, res) => {
  const blockerId = requireUserId(req);
  const { counterpartyId } = req.params;

  await blockService.blockUser({ blockerId, blockedId: counterpartyId });
  res.status(StatusCodes.OK).json({ success: true });
};

const unblockUser = async (req, res) => {
  const blockerId = requireUserId(req);
  const { counterpartyId } = req.params;

  await blockService.unblockUser({ blockerId, blockedId: counterpartyId });
  res.status(StatusCodes.OK).json({ success: true });
};

const clearConversation = async (req, res) => {
  const userId = requireUserId(req);
  const { counterpartyId } = req.params;

  await conversationService.clearConversation({ userId, counterpartyId });
  res.status(StatusCodes.OK).json({ success: true });
};

const markRead = async (req, res) => {
  const userId = requireUserId(req);
  const { counterpartyId } = req.params;

  await conversationService.markConversationRead({ userId, counterpartyId });
  res.status(StatusCodes.OK).json({ success: true });
};

module.exports = {
  listConversations,
  listMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  getContactCard,
  addContact,
  removeContact,
  listContacts,
  listBlocked,
  blockUser,
  unblockUser,
  clearConversation,
  markRead,
};
