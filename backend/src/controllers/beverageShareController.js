const { StatusCodes } = require("http-status-codes");
const { BadRequestError } = require("../errors");
const beverageShareService = require("../services/beverageShareService");

const requireUserId = (req) => {
  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }
  return req.user.userId;
};

// Pushes a real-time notification to exactly one user's authenticated socket
// room. Same mechanism and reasoning as ticketShareController.notifyUser —
// best-effort, never allowed to fail the HTTP request that triggered it.
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

const searchRecipients = async (req, res) => {
  const currentUserId = requireUserId(req);
  const results = await beverageShareService.searchRecipients({
    currentUserId,
    query: req.query.q,
  });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const listContacts = async (req, res) => {
  const currentUserId = requireUserId(req);
  const results = await beverageShareService.listContacts({ currentUserId });
  res.status(StatusCodes.OK).json({ success: true, data: results });
};

const createShare = async (req, res) => {
  const fromUserId = requireUserId(req);
  const { toUserId, salesContext, items, message, idempotencyKey } = req.body || {};

  const share = await beverageShareService.createShare({
    fromUserId,
    toUserId,
    salesContext,
    items,
    message,
    idempotencyKey,
  });

  notifyUser(req, share.toUser?._id || share.toUser, "beverage:transfer", {
    shareId: share._id,
    status: "pending",
    fromUser: share.fromUser,
  });

  res.status(StatusCodes.CREATED).json({ success: true, data: share });
};

const listShares = async (req, res) => {
  const userId = requireUserId(req);
  const { direction, status } = req.query;

  const shares = await beverageShareService.listShares({ userId, direction, status });

  res.status(StatusCodes.OK).json({ success: true, data: shares });
};

const getShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await beverageShareService.getShareForUser({
    shareId: req.params.shareId,
    userId,
  });
  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const acceptShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await beverageShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: true,
  });

  const fromUserId = share.fromUser?._id || share.fromUser;
  notifyUser(req, share.toUser?._id || share.toUser, "beverage:received", {
    shareId: share._id,
    items: share.items,
  });
  notifyUser(req, fromUserId, "beverage:transfer", {
    shareId: share._id,
    status: "accepted",
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const declineShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await beverageShareService.respondToShare({
    shareId: req.params.shareId,
    userId,
    accept: false,
  });

  notifyUser(req, share.fromUser?._id || share.fromUser, "beverage:transfer", {
    shareId: share._id,
    status: "declined",
  });

  res.status(StatusCodes.OK).json({ success: true, data: share });
};

const cancelShare = async (req, res) => {
  const userId = requireUserId(req);
  const share = await beverageShareService.cancelShare({
    shareId: req.params.shareId,
    userId,
  });

  notifyUser(req, share.toUser?._id || share.toUser, "beverage:transfer", {
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
