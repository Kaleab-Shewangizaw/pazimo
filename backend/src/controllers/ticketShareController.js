const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const ticketShareService = require("../services/ticketShareService");
const pushService = require("../services/pushService");

const requireUserId = (req) => {
  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }
  return req.user.userId;
};

// Pushes a real-time notification to exactly one user's authenticated
// socket room (see server.js's "authenticate" handler — a socket only joins
// `user_<id>` after proving it holds that user's JWT). Best-effort: a
// notification failing to send must never fail the HTTP request that
// triggered it, same reasoning as capitalController.notifyOrganizer.
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

const searchRecipients = async (req, res) => {
  const currentUserId = requireUserId(req);
  const results = await ticketShareService.searchRecipients({
    currentUserId,
    query: req.query.q,
  });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const listContacts = async (req, res) => {
  const currentUserId = requireUserId(req);
  const results = await ticketShareService.listContacts({ currentUserId });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const createShare = async (req, res) => {
  const fromUserId = requireUserId(req);
  const { toUserId, items, message, idempotencyKey } = req.body || {};

  const share = await ticketShareService.createShare({
    fromUserId,
    toUserId,
    items,
    message,
    idempotencyKey,
  });

  const recipientId = share.toUser?._id || share.toUser;
  notifyUser(req, recipientId, "ticket:transfer", {
    shareId: share._id,
    status: "pending",
    fromUser: share.fromUser,
  });
  pushService.sendPushToUser({
    userId: recipientId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.fromUser),
    body: "🎟️ Sent you a ticket",
    data: { type: "ticket-share", shareId: share._id, counterpartyId: share.fromUser?._id || share.fromUser },
  });

  res.status(StatusCodes.CREATED).json({ success: true, data: share });
};

const listShares = async (req, res) => {
  const userId = requireUserId(req);
  const { direction, status } = req.query;

  const shares = await ticketShareService.listShares({
    userId,
    direction,
    status,
  });

  res.status(StatusCodes.OK).json({ success: true, data: shares });
};

const getShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await ticketShareService.getShareForUser({
    shareId: req.params.shareId,
    userId,
  });
  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const acceptShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await ticketShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: true,
  });

  const fromUserId = share.fromUser?._id || share.fromUser;
  const toUserId = share.toUser?._id || share.toUser;
  notifyUser(req, toUserId, "ticket:received", {
    shareId: share._id,
    items: share.items,
  });
  notifyUser(req, fromUserId, "ticket:transfer", {
    shareId: share._id,
    status: "accepted",
  });
  pushService.sendPushToUser({
    userId: fromUserId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.toUser),
    body: "🎟️ Accepted your ticket",
    data: { type: "ticket-share", shareId: share._id, counterpartyId: toUserId },
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const declineShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await ticketShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: false,
  });

  const fromUserId = share.fromUser?._id || share.fromUser;
  notifyUser(req, fromUserId, "ticket:transfer", {
    shareId: share._id,
    status: "declined",
  });
  pushService.sendPushToUser({
    userId: fromUserId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.toUser),
    body: "Declined your ticket",
    data: { type: "ticket-share", shareId: share._id, counterpartyId: share.toUser?._id || share.toUser },
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const cancelShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await ticketShareService.cancelShare({
    shareId: req.params.shareId,
    userId,
  });

  notifyUser(req, share.toUser?._id || share.toUser, "ticket:transfer", {
    shareId: share._id,
    status: "cancelled",
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

module.exports = {
  searchRecipients,
  listContacts,
  createShare,
  listShares,
  getShare,
  acceptShare,
  declineShare,
  cancelShare,
};
