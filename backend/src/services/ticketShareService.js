const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const TicketShare = require("../models/TicketShare");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require("../errors");

const SHARE_EXPIRY_DAYS = 3;
const MAX_TICKETS_PER_SHARE = 20;
const SEARCH_RESULT_LIMIT = 20;
const CONTACTS_LIMIT = 30;

// Same "transaction where the deployment supports it, best-effort sequential
// writes where it doesn't" convention as ledgerService.withOptionalTransaction
// (see backend/src/services/ledgerService.js) — production is an Atlas
// replica set and gets real atomicity; a developer's standalone mongod
// cannot run transactions at all, so it falls back to plain writes instead of
// throwing.
let transactionSupport;
const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(info.setName) || info.msg === "isdbgrid";
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
};

const withOptionalTransaction = async (fn) => {
  if (!(await supportsTransactions())) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sharePopulateOptions = [
  {
    path: "tickets",
    select: "ticketId ticketType price currency status checkedIn event",
    populate: { path: "event", select: "title startDate location" },
  },
  { path: "fromUser", select: "firstName lastName phoneNumber" },
  { path: "toUser", select: "firstName lastName phoneNumber" },
];

// Transitions any pending share matched by `extraFilter` past its expiresAt
// to "expired" and frees the tickets it was holding. Called lazily from read
// paths (there is no cron for this) so history always reflects reality by the
// time anyone looks at it.
const expireDueShares = async (extraFilter = {}) => {
  const now = new Date();
  const stale = await TicketShare.find({
    status: "pending",
    expiresAt: { $lt: now },
    ...extraFilter,
  }).select("_id tickets");

  if (!stale.length) return;

  const shareIds = stale.map((s) => s._id);
  const ticketIds = stale.flatMap((s) => s.tickets);

  await TicketShare.updateMany(
    { _id: { $in: shareIds } },
    { $set: { status: "expired", respondedAt: now } }
  );
  await Ticket.updateMany(
    { _id: { $in: ticketIds }, pendingShare: { $in: shareIds } },
    { $set: { pendingShare: null } }
  );
};

// ---------------------------------------------------------------------------
// Recipient search / recents
// ---------------------------------------------------------------------------

const searchRecipients = async ({ currentUserId, query }) => {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  return User.find({
    _id: { $ne: currentUserId },
    isActive: true,
    isBanned: false,
    $or: [
      { firstName: regex },
      { lastName: regex },
      { phoneNumber: regex },
      { email: regex },
    ],
  })
    .select("firstName lastName phoneNumber")
    .limit(SEARCH_RESULT_LIMIT)
    .lean();
};

// "Auto-saved recents": derived from past shares rather than a separate
// contacts collection, so there is nothing to keep in sync — anyone the user
// has ever sent a ticket to or received one from surfaces here, most recent
// interaction first.
const listContacts = async ({ currentUserId }) => {
  const uid = new mongoose.Types.ObjectId(currentUserId);

  return TicketShare.aggregate([
    { $match: { $or: [{ fromUser: uid }, { toUser: uid }] } },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        contact: {
          $cond: [{ $eq: ["$fromUser", uid] }, "$toUser", "$fromUser"],
        },
      },
    },
    {
      $group: {
        _id: "$contact",
        lastSharedAt: { $first: "$createdAt" },
        shareCount: { $sum: 1 },
      },
    },
    { $sort: { lastSharedAt: -1 } },
    { $limit: CONTACTS_LIMIT },
    {
      $lookup: {
        from: User.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        phoneNumber: "$user.phoneNumber",
        lastSharedAt: 1,
        shareCount: 1,
      },
    },
  ]);
};

// ---------------------------------------------------------------------------
// Creating a share
// ---------------------------------------------------------------------------

const createShare = async ({ fromUserId, toUserId, ticketIds, message }) => {
  if (!toUserId || !isValidId(toUserId)) {
    throw new BadRequestError("A valid recipient is required");
  }
  if (String(toUserId) === String(fromUserId)) {
    throw new BadRequestError("You can't share a ticket with yourself");
  }

  const uniqueTicketIds = [...new Set((ticketIds || []).map(String))];
  if (!uniqueTicketIds.length) {
    throw new BadRequestError("Select at least one ticket to share");
  }
  if (uniqueTicketIds.length > MAX_TICKETS_PER_SHARE) {
    throw new BadRequestError(
      `You can share at most ${MAX_TICKETS_PER_SHARE} tickets at once`
    );
  }
  if (uniqueTicketIds.some((id) => !isValidId(id))) {
    throw new BadRequestError("One or more ticket ids are invalid");
  }

  const trimmedMessage = message ? String(message).trim() : undefined;
  if (trimmedMessage && trimmedMessage.length > 500) {
    throw new BadRequestError("Message is too long (500 characters max)");
  }

  const recipient = await User.findOne({
    _id: toUserId,
    isActive: true,
    isBanned: false,
  }).select("_id");
  if (!recipient) {
    throw new NotFoundError("Recipient not found");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const created = await TicketShare.create(
      [
        {
          tickets: uniqueTicketIds,
          fromUser: fromUserId,
          toUser: toUserId,
          message: trimmedMessage,
          status: "pending",
          expiresAt,
        },
      ],
      opts
    );
    const share = created[0];

    for (const ticketId of uniqueTicketIds) {
      // Conditional on every field that makes a ticket shareable, so this
      // single atomic update both locks the ticket and re-validates it —
      // closing the race window against a concurrent share, check-in, or
      // cancellation of the same ticket.
      const locked = await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          user: fromUserId,
          status: "active",
          paymentStatus: "completed",
          checkedIn: false,
          isInvitation: false,
          isOnDoor: false,
          pendingShare: null,
        },
        { $set: { pendingShare: share._id } },
        { new: true, ...opts }
      );
      if (!locked) {
        throw new ConflictError(
          `Ticket ${ticketId} isn't available to share right now (already used, cancelled, or already part of another pending share)`
        );
      }
    }

    return TicketShare.findById(share._id, null, opts).populate(
      sharePopulateOptions
    );
  });
};

// ---------------------------------------------------------------------------
// Listing / reading
// ---------------------------------------------------------------------------

const listShares = async ({ userId, direction, status }) => {
  await expireDueShares({ $or: [{ fromUser: userId }, { toUser: userId }] });

  const filter = {};
  if (direction === "sent") filter.fromUser = userId;
  else if (direction === "received") filter.toUser = userId;
  else filter.$or = [{ fromUser: userId }, { toUser: userId }];

  if (status) filter.status = status;

  return TicketShare.find(filter)
    .populate(sharePopulateOptions)
    .sort("-createdAt");
};

const getShareForUser = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  const share = await TicketShare.findById(shareId).populate(
    sharePopulateOptions
  );
  if (!share) throw new NotFoundError("Share not found");

  const isParticipant =
    String(share.fromUser?._id || share.fromUser) === String(userId) ||
    String(share.toUser?._id || share.toUser) === String(userId);
  if (!isParticipant) {
    throw new ForbiddenError("Not authorized to view this share");
  }

  return share;
};

// ---------------------------------------------------------------------------
// Responding
// ---------------------------------------------------------------------------

const respondToShare = async ({ shareId, userId, accept }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  // Settled outside the transaction below, on purpose: if this write happened
  // inside it and the function then threw to report "expired", the abort
  // triggered by that throw would roll the expiry itself back too, leaving
  // the share stuck pending forever while telling the caller otherwise.
  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await TicketShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.toUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to respond to this share");
    }

    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    if (accept) {
      for (const ticketId of share.tickets) {
        const updated = await Ticket.findOneAndUpdate(
          { _id: ticketId, pendingShare: share._id },
          { $set: { user: share.toUser, pendingShare: null } },
          { new: true, ...opts }
        );
        if (!updated) {
          throw new ConflictError(
            "A ticket in this share is no longer available"
          );
        }
      }
      await User.updateOne(
        { _id: share.fromUser },
        { $pull: { tickets: { $in: share.tickets } } },
        opts
      );
      await User.updateOne(
        { _id: share.toUser },
        { $addToSet: { tickets: { $each: share.tickets } } },
        opts
      );
      share.status = "accepted";
    } else {
      await Ticket.updateMany(
        { _id: { $in: share.tickets }, pendingShare: share._id },
        { $set: { pendingShare: null } },
        opts
      );
      share.status = "declined";
    }

    share.respondedAt = new Date();
    await share.save(opts);

    return TicketShare.findById(share._id, null, opts).populate(
      sharePopulateOptions
    );
  });
};

const cancelShare = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await TicketShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.fromUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to cancel this share");
    }
    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    await Ticket.updateMany(
      { _id: { $in: share.tickets }, pendingShare: share._id },
      { $set: { pendingShare: null } },
      opts
    );
    share.status = "cancelled";
    share.respondedAt = new Date();
    await share.save(opts);

    return TicketShare.findById(share._id, null, opts).populate(
      sharePopulateOptions
    );
  });
};

module.exports = {
  SHARE_EXPIRY_DAYS,
  searchRecipients,
  listContacts,
  createShare,
  listShares,
  getShareForUser,
  respondToShare,
  cancelShare,
};
