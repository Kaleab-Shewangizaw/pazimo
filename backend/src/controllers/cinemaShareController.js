const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const cinemaShareService = require("../services/cinemaShareService");
const pushService = require("../services/pushService");

// Bare `async (req, res)` handlers, unguarded by a local try/catch — safe
// here because middlewares/asyncErrors.js (required once, at the top of
// app.js, before any router) patches Express 4 to forward every rejected
// handler promise into the error middleware at the bottom of app.js. Same
// convention ticketShareController.js and beverageShareController.js use.

const requireUserId = (req) => {
  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }
  return req.user.userId;
};

// Pushes a real-time notification to exactly one user's authenticated socket
// room. Same mechanism and reasoning as ticketShareController.notifyUser /
// beverageShareController.notifyUser — best-effort, never allowed to fail
// the HTTP request that triggered it.
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
  const results = await cinemaShareService.searchRecipients({
    currentUserId,
    query: req.query.q,
  });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const listContacts = async (req, res) => {
  const currentUserId = requireUserId(req);
  const results = await cinemaShareService.listContacts({ currentUserId });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const createShare = async (req, res) => {
  const fromUserId = requireUserId(req);
  const { toUserId, itemType, items, message, idempotencyKey } = req.body || {};

  const share = await cinemaShareService.createShare({
    fromUserId,
    toUserId,
    itemType,
    items,
    message,
    idempotencyKey,
  });

  const recipientId = share.toUser?._id || share.toUser;
  notifyUser(req, recipientId, "cinema:transfer", {
    shareId: share._id,
    status: "pending",
    fromUser: share.fromUser,
  });
  pushService.sendPushToUser({
    userId: recipientId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.fromUser),
    body: share.itemType === "CINEMA_CONCESSION" ? "🍿 Sent you a snack" : "🎬 Sent you a cinema ticket",
    data: { type: "cinema-share", shareId: share._id, counterpartyId: share.fromUser?._id || share.fromUser },
  });

  res.status(StatusCodes.CREATED).json({ success: true, data: share });
};

const listShares = async (req, res) => {
  const userId = requireUserId(req);
  const { direction, status } = req.query;

  const shares = await cinemaShareService.listShares({ userId, direction, status });

  res.status(StatusCodes.OK).json({ success: true, data: shares });
};

const getShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await cinemaShareService.getShareForUser({
    shareId: req.params.shareId,
    userId,
  });
  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const acceptShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await cinemaShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: true,
  });

  const fromUserId = share.fromUser?._id || share.fromUser;
  const toUserId = share.toUser?._id || share.toUser;
  notifyUser(req, toUserId, "cinema:received", {
    shareId: share._id,
    items: share.items,
  });
  notifyUser(req, fromUserId, "cinema:transfer", {
    shareId: share._id,
    status: "accepted",
  });
  pushService.sendPushToUser({
    userId: fromUserId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.toUser),
    body: share.itemType === "CINEMA_CONCESSION" ? "🍿 Accepted your snack" : "🎬 Accepted your cinema ticket",
    data: { type: "cinema-share", shareId: share._id, counterpartyId: toUserId },
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const declineShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await cinemaShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: false,
  });

  const fromUserId = share.fromUser?._id || share.fromUser;
  notifyUser(req, fromUserId, "cinema:transfer", {
    shareId: share._id,
    status: "declined",
  });
  pushService.sendPushToUser({
    userId: fromUserId,
    preferenceKey: "ticketUpdates",
    title: nameOf(share.toUser),
    body: share.itemType === "CINEMA_CONCESSION" ? "Declined your snack" : "Declined your cinema ticket",
    data: { type: "cinema-share", shareId: share._id, counterpartyId: share.toUser?._id || share.toUser },
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const cancelShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await cinemaShareService.cancelShare({
    shareId: req.params.shareId,
    userId,
  });

  notifyUser(req, share.toUser?._id || share.toUser, "cinema:transfer", {
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
