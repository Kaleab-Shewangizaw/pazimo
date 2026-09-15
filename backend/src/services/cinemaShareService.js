const mongoose = require("mongoose");
const User = require("../models/User");
const CinemaShare = require("../models/CinemaShare");
const CinemaTicket = require("../models/CinemaTicket");
const CinemaBeverageSale = require("../models/CinemaBeverageSale");
const { searchRecipients } = require("./ticketShareService");
const { touchConversation } = require("./conversationService");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require("../errors");

// The cinema twin of beverageShareService.js — same shape, but FULL-only:
// a cinema ticket admits a specific set of seats and a concession sale is one
// counter handover, and neither has a meaningful "send half of it" reading
// the way a multi-admission event ticket or a multi-unit drink sale does. So
// there is no transferType, no resultingItem, no split-math, no child
// document — accepting a share just reassigns `customer` on the same
// document, exactly like Ticket's FULL branch, and nothing else changes.

const SHARE_EXPIRY_DAYS = 3;
const MAX_ITEMS_PER_SHARE = 20;
const CONTACTS_LIMIT = 30;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const ItemModelFor = (itemType) =>
  itemType === "CINEMA_CONCESSION" ? CinemaBeverageSale : CinemaTicket;

// Same "transaction where the deployment supports it, best-effort sequential
// writes where it doesn't" convention ticketShareService.js/
// beverageShareService.js use.
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

// ---------------------------------------------------------------------------
// Populating a share's item details
//
// items.item carries no schema `ref` (the target collection depends on the
// share's own itemType), so population is done by hand here, batched per
// itemType across every share passed in — the same reasoning
// beverageShareService's attachSaleDetails gives.
// ---------------------------------------------------------------------------

const ticketSelect =
  "ticketId movieTitle hallName showtimeStartsAt ticketType price quantity totalAmount currency seats status checkedIn";
const concessionSelect =
  "referenceNumber beverageName beverageColor beverageCategory unitPrice quantity totalAmount currency status redeemedAt soldAt";

const attachItemDetails = async (shares) => {
  const list = Array.isArray(shares) ? shares : [shares];
  if (!list.length) return list;

  const ticketIds = new Set();
  const concessionIds = new Set();
  for (const share of list) {
    const bucket = share.itemType === "CINEMA_CONCESSION" ? concessionIds : ticketIds;
    for (const item of share.items) bucket.add(String(item.item));
  }

  const [tickets, concessions] = await Promise.all([
    ticketIds.size
      ? CinemaTicket.find({ _id: { $in: [...ticketIds] } })
          .select(ticketSelect)
          .populate("movie", "title poster")
          .populate("cinema", "name city")
          .lean()
      : [],
    concessionIds.size
      ? CinemaBeverageSale.find({ _id: { $in: [...concessionIds] } })
          .select(concessionSelect)
          .populate("cinema", "name city")
          .lean()
      : [],
  ]);

  const detailsById = new Map([...tickets, ...concessions].map((d) => [String(d._id), d]));

  return list.map((share) => {
    const obj = share.toObject ? share.toObject() : share;
    obj.items = obj.items.map((item) => ({
      ...item,
      itemDetails: detailsById.get(String(item.item)) || null,
    }));
    return obj;
  });
};

const itemIdsOf = (share) => share.items.map((i) => i.item);

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

const expireDueShares = async (extraFilter = {}) => {
  const now = new Date();
  const stale = await CinemaShare.find({
    status: "pending",
    expiresAt: { $lt: now },
    ...extraFilter,
  }).select("_id itemType items.item");

  if (!stale.length) return;

  const shareIds = stale.map((s) => s._id);
  await CinemaShare.updateMany(
    { _id: { $in: shareIds } },
    { $set: { status: "expired", respondedAt: now } }
  );

  for (const itemType of ["CINEMA_TICKET", "CINEMA_CONCESSION"]) {
    const relevant = stale.filter((s) => s.itemType === itemType);
    if (!relevant.length) continue;
    const itemIds = relevant.flatMap(itemIdsOf);
    const relevantShareIds = relevant.map((s) => s._id);
    await ItemModelFor(itemType).updateMany(
      { _id: { $in: itemIds }, pendingShare: { $in: relevantShareIds } },
      { $set: { pendingShare: null } }
    );
  }
};

// ---------------------------------------------------------------------------
// Recipient search / recents
// ---------------------------------------------------------------------------

const listContacts = async ({ currentUserId }) => {
  const uid = new mongoose.Types.ObjectId(currentUserId);

  return CinemaShare.aggregate([
    { $match: { $or: [{ fromUser: uid }, { toUser: uid }] } },
    { $sort: { createdAt: -1 } },
    {
      $addFields: {
        contact: { $cond: [{ $eq: ["$fromUser", uid] }, "$toUser", "$fromUser"] },
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
        from: "users",
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
        username: "$user.username",
        lastSharedAt: 1,
        shareCount: 1,
      },
    },
  ]);
};

// ---------------------------------------------------------------------------
// Creating a share
// ---------------------------------------------------------------------------

const createShare = async ({
  fromUserId,
  toUserId,
  itemType,
  items,
  message,
  idempotencyKey,
}) => {
  if (!["CINEMA_TICKET", "CINEMA_CONCESSION"].includes(itemType)) {
    throw new BadRequestError("A valid itemType is required");
  }
  const ItemModel = ItemModelFor(itemType);

  if (!toUserId || !isValidId(toUserId)) {
    throw new BadRequestError("A valid recipient is required");
  }
  if (String(toUserId) === String(fromUserId)) {
    throw new BadRequestError("You can't send this to yourself");
  }

  const trimmedKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 200) : undefined;
  if (trimmedKey) {
    const existing = await CinemaShare.findOne({
      fromUser: fromUserId,
      idempotencyKey: trimmedKey,
    });
    if (existing) {
      const [populated] = await attachItemDetails(existing);
      return populated;
    }
  }

  const rawItems = Array.isArray(items) ? items : [];
  if (!rawItems.length) {
    throw new BadRequestError("Select at least one item to send");
  }
  if (rawItems.length > MAX_ITEMS_PER_SHARE) {
    throw new BadRequestError(`You can send at most ${MAX_ITEMS_PER_SHARE} items at once`);
  }

  const seen = new Set();
  const parsedItems = rawItems.map((raw) => {
    const itemId = String(raw?.itemId || raw?.item || "");
    if (!isValidId(itemId)) {
      throw new BadRequestError("One or more item ids are invalid");
    }
    if (seen.has(itemId)) {
      throw new BadRequestError("Each item can only appear once per share");
    }
    seen.add(itemId);

    const quantity = Number(raw?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestError(
        `Invalid quantity for ${itemId} — must be a whole number of at least 1`
      );
    }
    return { itemId, quantity };
  });

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

  // "active" specifically, not just "not cancelled/refunded" — a ticket
  // that has already been admitted flips to "used" (see
  // cinemaTicketService.checkInTicket), and there is no reason to let an
  // already-consumed seat be handed to someone else.
  const eligibilityFilter =
    itemType === "CINEMA_CONCESSION"
      ? { channel: "online", status: "confirmed", redeemedAt: null }
      : { paymentStatus: "completed", status: "active" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const shareId = new mongoose.Types.ObjectId();

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const lockedItems = [];
    for (const { itemId, quantity } of parsedItems) {
      // Conditional on every field that makes an item shareable, so this one
      // atomic update both locks it and re-validates it — closing the race
      // window against a concurrent share, check-in, or redemption of the
      // same item.
      const locked = await ItemModel.findOneAndUpdate(
        {
          _id: itemId,
          customer: fromUserId,
          pendingShare: null,
          ...eligibilityFilter,
        },
        { $set: { pendingShare: shareId } },
        { new: true, ...opts }
      ).select("quantity");
      if (!locked) {
        throw new ConflictError(
          "One of your items isn't available to send right now (already used, refunded, or already part of another pending transfer)"
        );
      }

      // FULL only: a cinema ticket's seats and a concession sale's units
      // don't split, so the request must name exactly what the item holds.
      if (quantity !== locked.quantity) {
        await ItemModel.updateOne({ _id: itemId }, { $set: { pendingShare: null } }, opts);
        throw new BadRequestError(
          `This can only be sent in full — it has ${locked.quantity}, not ${quantity}`
        );
      }

      lockedItems.push({ item: itemId, quantity });
    }

    const created = await CinemaShare.create(
      [
        {
          _id: shareId,
          itemType,
          items: lockedItems,
          fromUser: fromUserId,
          toUser: toUserId,
          message: trimmedMessage,
          status: "pending",
          expiresAt,
          idempotencyKey: trimmedKey,
        },
      ],
      opts
    );

    // Best-effort, outside the transaction — see ticketShareService's
    // identical call for why this must never fail a real transfer.
    touchConversation({
      userAId: fromUserId,
      userBId: toUserId,
      senderId: fromUserId,
      preview: itemType === "CINEMA_CONCESSION" ? "🍿 Snack sent" : "🎬 Cinema ticket sent",
      kind: itemType,
      at: created[0].createdAt,
    }).catch((error) => console.error("Failed to touch conversation for cinema share:", error.message));

    const [populated] = await attachItemDetails(created[0]);
    return populated;
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

  const shares = await CinemaShare.find(filter)
    .populate("fromUser", "firstName lastName username")
    .populate("toUser", "firstName lastName username")
    .sort("-createdAt")
    .lean();

  return attachItemDetails(shares);
};

const getShareForUser = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  const share = await CinemaShare.findById(shareId)
    .populate("fromUser", "firstName lastName username")
    .populate("toUser", "firstName lastName username")
    .lean();
  if (!share) throw new NotFoundError("Share not found");

  const isParticipant =
    String(share.fromUser?._id || share.fromUser) === String(userId) ||
    String(share.toUser?._id || share.toUser) === String(userId);
  if (!isParticipant) {
    throw new ForbiddenError("Not authorized to view this share");
  }

  const [populated] = await attachItemDetails(share);
  return populated;
};

// ---------------------------------------------------------------------------
// Responding
// ---------------------------------------------------------------------------

const respondToShare = async ({ shareId, userId, accept }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await CinemaShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.toUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to respond to this share");
    }
    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    const ItemModel = ItemModelFor(share.itemType);

    if (accept) {
      for (const item of share.items) {
        const doc = await ItemModel.findOne(
          { _id: item.item, pendingShare: share._id },
          null,
          opts
        );
        if (!doc) {
          throw new ConflictError("An item in this share is no longer available");
        }

        // FULL only — the same document just changes hands, same as Ticket's
        // FULL branch and BeverageShare's. Snapshot fields (customerName/
        // customerPhone) stay as who originally bought it; `customer` is the
        // one field that says who holds it now.
        doc.customer = share.toUser;
        doc.pendingShare = null;
        await doc.save(opts);
      }

      share.status = "accepted";
    } else {
      await ItemModel.updateMany(
        { _id: { $in: itemIdsOf(share) }, pendingShare: share._id },
        { $set: { pendingShare: null } },
        opts
      );
      share.status = "declined";
    }

    share.respondedAt = new Date();
    await share.save(opts);

    const [populated] = await attachItemDetails(share);
    return populated;
  });
};

const cancelShare = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await CinemaShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.fromUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to cancel this share");
    }
    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    await ItemModelFor(share.itemType).updateMany(
      { _id: { $in: itemIdsOf(share) }, pendingShare: share._id },
      { $set: { pendingShare: null } },
      opts
    );
    share.status = "cancelled";
    share.respondedAt = new Date();
    await share.save(opts);

    const [populated] = await attachItemDetails(share);
    return populated;
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
  expireDueShares,
};
