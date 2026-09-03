const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const TicketShare = require("../models/TicketShare");
const { normalizePhone } = require("../utils/phone");
const { round2 } = require("../config/rates");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require("../errors");

const SHARE_EXPIRY_DAYS = 3;
const MAX_ITEMS_PER_SHARE = 20;
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
    path: "items.ticket",
    select: "ticketId ticketType price currency status checkedIn ticketCount event",
    populate: { path: "event", select: "title startDate location" },
  },
  {
    path: "items.resultingTicket",
    select: "ticketId ticketType price currency status checkedIn ticketCount event parentTicketId rootTicketId",
  },
  { path: "fromUser", select: "firstName lastName username" },
  { path: "toUser", select: "firstName lastName username" },
];

const ticketIdsOf = (share) => share.items.map((i) => i.ticket);

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
  }).select("_id items.ticket");

  if (!stale.length) return;

  const shareIds = stale.map((s) => s._id);
  const ticketIds = stale.flatMap((s) => ticketIdsOf(s));

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

// Telegram-style exact match only: a caller must type the whole username or
// the whole phone number (any format — see normalizePhone) to resolve
// exactly one account. No prefix/substring matching, so typing part of a
// username or number can never enumerate who else uses Pazimo.
const searchRecipients = async ({ currentUserId, query }) => {
  const q = String(query || "").trim();
  if (!q) return [];

  const or = [];

  // A string that's mostly digits/phone punctuation is treated as a phone
  // number attempt; normalizePhone itself rejects anything that doesn't end
  // up looking like a real number, so a short numeric username never leaks
  // through this branch.
  if (/^[+\d][\d\s\-()]{6,}$/.test(q)) {
    const normalized = normalizePhone(q);
    if (normalized) or.push({ normalizedPhone: normalized });
  }

  if (/^[A-Za-z0-9_]{3,20}$/.test(q)) {
    or.push({ username: q.toLowerCase() });
  }

  if (!or.length) return [];

  return User.find({
    _id: { $ne: currentUserId },
    isActive: true,
    isBanned: false,
    $or: or,
  })
    .select("firstName lastName username")
    .limit(2) // exact match resolves to at most one account per clause
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
  items,
  message,
  idempotencyKey,
}) => {
  if (!toUserId || !isValidId(toUserId)) {
    throw new BadRequestError("A valid recipient is required");
  }
  if (String(toUserId) === String(fromUserId)) {
    throw new BadRequestError("You can't share a ticket with yourself");
  }

  // A retried POST (double tap, network retry, a WebSocket-reconnect resend)
  // carrying a key already on file for this sender returns the original
  // share instead of creating — and locking tickets for — a second one.
  const trimmedKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 200) : undefined;
  if (trimmedKey) {
    const existing = await TicketShare.findOne({
      fromUser: fromUserId,
      idempotencyKey: trimmedKey,
    });
    if (existing) {
      return TicketShare.findById(existing._id).populate(sharePopulateOptions);
    }
  }

  const rawItems = Array.isArray(items) ? items : [];
  if (!rawItems.length) {
    throw new BadRequestError("Select at least one ticket to share");
  }
  if (rawItems.length > MAX_ITEMS_PER_SHARE) {
    throw new BadRequestError(
      `You can share at most ${MAX_ITEMS_PER_SHARE} tickets at once`
    );
  }

  const seen = new Set();
  const parsedItems = rawItems.map((raw) => {
    const ticketId = String(raw?.ticketId || raw?.ticket || "");
    if (!isValidId(ticketId)) {
      throw new BadRequestError("One or more ticket ids are invalid");
    }
    if (seen.has(ticketId)) {
      throw new BadRequestError("Each ticket can only appear once per share");
    }
    seen.add(ticketId);

    const quantity = Number(raw?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestError(
        `Invalid quantity for ticket ${ticketId} — must be a whole number of at least 1`
      );
    }
    return { ticketId, quantity };
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

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SHARE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  // Pre-generated so each ticket can be locked with its final share id before
  // the TicketShare document itself exists — `items` (and its per-item
  // transferType) is only known once every ticket in the request has been
  // locked and its current ticketCount read, so the document can't be
  // created first and filled in after.
  const shareId = new mongoose.Types.ObjectId();

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const lockedItems = [];
    for (const { ticketId, quantity } of parsedItems) {
      // Conditional on every field that makes a ticket shareable, so this
      // single atomic update both locks the ticket and re-validates it —
      // closing the race window against a concurrent share, check-in, or
      // cancellation of the same ticket. ticketCount is the ticket's
      // *remaining* (not-yet-checked-in) capacity — the only part of it
      // that can legitimately change hands.
      const locked = await Ticket.findOneAndUpdate(
        {
          _id: ticketId,
          user: fromUserId,
          status: "active",
          paymentStatus: "completed",
          isInvitation: false,
          isOnDoor: false,
          pendingShare: null,
          ticketCount: { $gte: quantity },
        },
        { $set: { pendingShare: shareId } },
        { new: true, ...opts }
      ).select("ticketCount");
      if (!locked) {
        throw new ConflictError(
          `Ticket ${ticketId} isn't available to share right now (already used, cancelled, doesn't have ${quantity} admission(s) left, or already part of another pending share)`
        );
      }

      lockedItems.push({
        ticket: ticketId,
        quantity,
        transferType: quantity === locked.ticketCount ? "FULL" : "PARTIAL",
      });
    }

    const created = await TicketShare.create(
      [
        {
          _id: shareId,
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

    return TicketShare.findById(created[0]._id, null, opts).populate(
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
      for (const item of share.items) {
        const ticket = await Ticket.findOne(
          { _id: item.ticket, pendingShare: share._id },
          null,
          opts
        );
        if (!ticket) {
          throw new ConflictError(
            "A ticket in this share is no longer available"
          );
        }

        if (item.transferType === "FULL") {
          // Scenario A — the whole ticket (all of its remaining capacity)
          // changes hands. Same document, same ticketId/QR identity; only
          // ownership moves. The sender loses every trace of it as an
          // active ticket the moment this commits.
          ticket.user = share.toUser;
          ticket.pendingShare = null;
          if (!ticket.originalOwnerId) ticket.originalOwnerId = share.fromUser;
          await ticket.save(opts);

          await User.updateOne(
            { _id: share.fromUser },
            { $pull: { tickets: ticket._id } },
            opts
          );
          await User.updateOne(
            { _id: share.toUser },
            { $addToSet: { tickets: ticket._id } },
            opts
          );

          item.resultingTicket = ticket._id;
        } else {
          // Scenario B — split off exactly `item.quantity` admissions into a
          // brand-new ticket for the recipient. The sender keeps the
          // original ticketId/QR and whatever capacity remains; the
          // recipient's admissions are never reachable through the
          // sender's ticket again.
          if (ticket.ticketCount < item.quantity) {
            // Guarded already by the lock at share-creation time (see
            // createShare — ticketCount cannot move while pendingShare is
            // set), so this is a belt-and-suspenders check, not an expected
            // path.
            throw new ConflictError(
              "A ticket in this share no longer has enough remaining capacity"
            );
          }

          // childPrice is rounded first (it's the real amount that will show
          // up on the recipient's ticket/receipt); the sender's remainder is
          // then whatever's left of the original price, NOT independently
          // rounded — so the two always sum to exactly the original price,
          // with no shared cent lost or invented by rounding both sides.
          const childPrice = round2(
            (ticket.price * item.quantity) / ticket.ticketCount
          );
          const remainingPrice = ticket.price - childPrice;
          const remainingCount = ticket.ticketCount - item.quantity;
          const remainingPurchaseQty =
            typeof ticket.purchaseQuantity === "number"
              ? Math.max(0, ticket.purchaseQuantity - item.quantity)
              : undefined;

          ticket.price = remainingPrice;
          ticket.ticketCount = remainingCount;
          if (remainingPurchaseQty !== undefined) {
            ticket.purchaseQuantity = remainingPurchaseQty;
          }
          ticket.pendingShare = null;
          await ticket.save(opts);

          const createdChild = await Ticket.create(
            [
              {
                event: ticket.event,
                user: share.toUser,
                ticketType: ticket.ticketType,
                price: childPrice,
                commissionRate: ticket.commissionRate,
                organizerVatRate: ticket.organizerVatRate,
                currency: ticket.currency,
                status: "active",
                paymentStatus: "completed",
                ticketCount: item.quantity,
                purchaseQuantity: item.quantity,
                paymentReference: ticket.paymentReference,
                isInvitation: false,
                isOnDoor: false,
                checkedIn: false,
                parentTicketId: ticket._id,
                rootTicketId: ticket.rootTicketId || ticket._id,
                originalOwnerId: ticket.originalOwnerId || share.fromUser,
              },
            ],
            opts
          );
          const child = createdChild[0];

          await User.updateOne(
            { _id: share.toUser },
            { $addToSet: { tickets: child._id } },
            opts
          );

          item.resultingTicket = child._id;
        }
      }

      share.status = "accepted";
    } else {
      await Ticket.updateMany(
        { _id: { $in: ticketIdsOf(share) }, pendingShare: share._id },
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
      { _id: { $in: ticketIdsOf(share) }, pendingShare: share._id },
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
