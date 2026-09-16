const mongoose = require("mongoose");
const User = require("../models/User");
const BeverageShare = require("../models/BeverageShare");
const BeverageSale = require("../models/BeverageSale");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const { round2 } = require("../config/rates");
const { searchRecipients } = require("./ticketShareService");
const { touchConversation } = require("./conversationService");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require("../errors");

// The drinks twin of ticketShareService.js — see BeverageShare's model
// comment for where and why the two diverge. `searchRecipients` is reused
// unchanged (it's a pure User lookup, nothing ticket-specific about it);
// everything else here is BeverageShare's own version of the same shape.

const SHARE_EXPIRY_DAYS = 3;
const MAX_ITEMS_PER_SHARE = 20;
const CONTACTS_LIMIT = 30;

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const SaleModelFor = (salesContext) =>
  salesContext === "VENUE_BEVERAGE" ? VenueBeverageSale : BeverageSale;

// Same "transaction where the deployment supports it, best-effort sequential
// writes where it doesn't" convention ticketShareService.js uses.
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
// Populating a share's drink details
//
// items.sale/resultingSale carry no schema `ref` (the target collection
// depends on the share's own salesContext), so population is done by hand
// here rather than via Mongoose. Batched per salesContext across every share
// passed in, so listShares costs a handful of queries total, not one per row.
// ---------------------------------------------------------------------------

const saleSelect =
  "referenceNumber quantity unitPrice totalAmount currency status redeemedAt soldAt";

const attachSaleDetails = async (shares) => {
  const list = Array.isArray(shares) ? shares : [shares];
  if (!list.length) return list;

  const byContext = { EVENT_BEVERAGE: new Set(), VENUE_BEVERAGE: new Set() };
  for (const share of list) {
    for (const item of share.items) {
      byContext[share.salesContext]?.add(String(item.sale));
      if (item.resultingSale) byContext[share.salesContext]?.add(String(item.resultingSale));
    }
  }

  const [eventSales, venueSales] = await Promise.all([
    byContext.EVENT_BEVERAGE.size
      ? BeverageSale.find({ _id: { $in: [...byContext.EVENT_BEVERAGE] } })
          .select(saleSelect)
          .populate("beverage", "name color")
          .populate("event", "title startDate location")
          .lean()
      : [],
    byContext.VENUE_BEVERAGE.size
      ? VenueBeverageSale.find({ _id: { $in: [...byContext.VENUE_BEVERAGE] } })
          .select(saleSelect)
          .populate("beverage", "name color")
          .populate("venue", "name venueType city")
          .lean()
      : [],
  ]);

  const detailsById = new Map(
    [...eventSales, ...venueSales].map((s) => [String(s._id), s])
  );

  return list.map((share) => {
    const obj = share.toObject ? share.toObject() : share;
    obj.items = obj.items.map((item) => ({
      ...item,
      saleDetails: detailsById.get(String(item.sale)) || null,
      resultingSaleDetails: item.resultingSale
        ? detailsById.get(String(item.resultingSale)) || null
        : null,
    }));
    return obj;
  });
};

const saleIdsOf = (share) => share.items.map((i) => i.sale);

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

// Same lazy-expiry approach as ticketShareService.expireDueShares: no cron,
// called from every read path so history reflects reality by the time
// anyone looks at it.
const expireDueShares = async (extraFilter = {}) => {
  const now = new Date();
  const stale = await BeverageShare.find({
    status: "pending",
    expiresAt: { $lt: now },
    ...extraFilter,
  }).select("_id salesContext items.sale");

  if (!stale.length) return;

  const shareIds = stale.map((s) => s._id);
  await BeverageShare.updateMany(
    { _id: { $in: shareIds } },
    { $set: { status: "expired", respondedAt: now } }
  );

  for (const salesContext of ["EVENT_BEVERAGE", "VENUE_BEVERAGE"]) {
    const relevant = stale.filter((s) => s.salesContext === salesContext);
    if (!relevant.length) continue;
    const saleIds = relevant.flatMap(saleIdsOf);
    const relevantShareIds = relevant.map((s) => s._id);
    await SaleModelFor(salesContext).updateMany(
      { _id: { $in: saleIds }, pendingShare: { $in: relevantShareIds } },
      { $set: { pendingShare: null } }
    );
  }
};

// ---------------------------------------------------------------------------
// Recipient search / recents
// ---------------------------------------------------------------------------

// "Auto-saved recents", the BeverageShare equivalent of
// ticketShareService.listContacts — derived from past drink transfers.
const listContacts = async ({ currentUserId }) => {
  const uid = new mongoose.Types.ObjectId(currentUserId);

  return BeverageShare.aggregate([
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
  salesContext,
  items,
  message,
  idempotencyKey,
}) => {
  if (!["EVENT_BEVERAGE", "VENUE_BEVERAGE"].includes(salesContext)) {
    throw new BadRequestError("A valid salesContext is required");
  }
  const SaleModel = SaleModelFor(salesContext);

  if (!toUserId || !isValidId(toUserId)) {
    throw new BadRequestError("A valid recipient is required");
  }
  if (String(toUserId) === String(fromUserId)) {
    throw new BadRequestError("You can't send a drink to yourself");
  }

  const trimmedKey = idempotencyKey ? String(idempotencyKey).trim().slice(0, 200) : undefined;
  if (trimmedKey) {
    const existing = await BeverageShare.findOne({
      fromUser: fromUserId,
      idempotencyKey: trimmedKey,
    });
    if (existing) {
      const [populated] = await attachSaleDetails(existing);
      return populated;
    }
  }

  const rawItems = Array.isArray(items) ? items : [];
  if (!rawItems.length) {
    throw new BadRequestError("Select at least one drink to send");
  }
  if (rawItems.length > MAX_ITEMS_PER_SHARE) {
    throw new BadRequestError(`You can send at most ${MAX_ITEMS_PER_SHARE} drinks at once`);
  }

  const seen = new Set();
  const parsedItems = rawItems.map((raw) => {
    const saleId = String(raw?.saleId || raw?.sale || "");
    if (!isValidId(saleId)) {
      throw new BadRequestError("One or more drink ids are invalid");
    }
    if (seen.has(saleId)) {
      throw new BadRequestError("Each drink can only appear once per share");
    }
    seen.add(saleId);

    const quantity = Number(raw?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestError(
        `Invalid quantity for ${saleId} — must be a whole number of at least 1`
      );
    }
    return { saleId, quantity };
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
  const shareId = new mongoose.Types.ObjectId();

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const lockedItems = [];
    for (const { saleId, quantity } of parsedItems) {
      // Conditional on every field that makes a drink shareable, so this one
      // atomic update both locks it and re-validates it — closing the race
      // window against a concurrent share or redemption of the same sale.
      const locked = await SaleModel.findOneAndUpdate(
        {
          _id: saleId,
          customer: fromUserId,
          channel: "online",
          status: "confirmed",
          redeemedAt: null,
          pendingShare: null,
          quantity: { $gte: quantity },
        },
        { $set: { pendingShare: shareId } },
        { new: true, ...opts }
      ).select("quantity");
      if (!locked) {
        throw new ConflictError(
          `One of your drinks isn't available to send right now (already collected, refunded, doesn't have ${quantity} left, or already part of another pending transfer)`
        );
      }

      lockedItems.push({
        sale: saleId,
        quantity,
        transferType: quantity === locked.quantity ? "FULL" : "PARTIAL",
      });
    }

    const created = await BeverageShare.create(
      [
        {
          _id: shareId,
          salesContext,
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
    // identical call for why this must never fail a real drink transfer.
    touchConversation({
      userAId: fromUserId,
      userBId: toUserId,
      senderId: fromUserId,
      preview: "🥤 Drink sent",
      kind: "BEVERAGE",
      at: created[0].createdAt,
    }).catch((error) => console.error("Failed to touch conversation for beverage share:", error.message));

    // Populated here (unlike the bare `created[0]`) so the controller's push
    // notification can put a real name in the title instead of "Someone" —
    // the same shape `listShares`/`getShareForUser` already populate.
    await created[0].populate([
      { path: "fromUser", select: "firstName lastName username" },
      { path: "toUser", select: "firstName lastName username" },
    ]);
    const [populated] = await attachSaleDetails(created[0]);
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

  const shares = await BeverageShare.find(filter)
    .populate("fromUser", "firstName lastName username")
    .populate("toUser", "firstName lastName username")
    .sort("-createdAt")
    .lean();

  return attachSaleDetails(shares);
};

const getShareForUser = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  const share = await BeverageShare.findById(shareId)
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

  const [populated] = await attachSaleDetails(share);
  return populated;
};

// ---------------------------------------------------------------------------
// Building a split child sale
// ---------------------------------------------------------------------------

// Field names differ between BeverageSale (event/organizer/eventBeverage/
// organizerVatRate) and VenueBeverageSale (venue/venueBeverage/venueVatRate)
// — this is the one place that has to know both shapes, so the accept logic
// below doesn't.
const buildChildData = (salesContext, sale, toUser, quantity, childAmount) => {
  const base = {
    beverage: sale.beverage,
    beverageName: sale.beverageName,
    beverageColor: sale.beverageColor,
    unitPrice: sale.unitPrice,
    quantity,
    totalAmount: childAmount,
    currency: sale.currency,
    customer: toUser,
    status: "confirmed",
    channel: "online",
    paymentReference: sale.paymentReference,
    commissionRate: sale.commissionRate,
    // Kept from the parent rather than defaulting to now: a transfer is not a
    // new sale event financially, and revenue-by-date reporting must not
    // shift money to the day it happened to be handed off.
    soldAt: sale.soldAt,
  };
  if (salesContext === "VENUE_BEVERAGE") {
    return {
      ...base,
      venue: sale.venue,
      venueBeverage: sale.venueBeverage,
      venueVatRate: sale.venueVatRate,
    };
  }
  return {
    ...base,
    event: sale.event,
    organizer: sale.organizer,
    eventBeverage: sale.eventBeverage,
    organizerVatRate: sale.organizerVatRate,
  };
};

// ---------------------------------------------------------------------------
// Responding
// ---------------------------------------------------------------------------

const respondToShare = async ({ shareId, userId, accept }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  // Settled outside the transaction below — see ticketShareService's
  // identical comment on why (an abort here must not roll back a real
  // expiry that already happened).
  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await BeverageShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.toUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to respond to this share");
    }
    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    const SaleModel = SaleModelFor(share.salesContext);

    if (accept) {
      for (const item of share.items) {
        const sale = await SaleModel.findOne(
          { _id: item.sale, pendingShare: share._id },
          null,
          opts
        );
        if (!sale) {
          throw new ConflictError("A drink in this share is no longer available");
        }

        if (item.transferType === "FULL") {
          // The whole sale changes hands — same document, only ownership
          // moves. customerName/customerPhone stay as the snapshot of who
          // originally bought it (same reasoning unitPrice/commissionRate are
          // never rewritten); `customer` is the one field that says who holds
          // it now.
          sale.customer = share.toUser;
          sale.pendingShare = null;
          await sale.save(opts);
          item.resultingSale = sale._id;
        } else {
          if (sale.quantity < item.quantity) {
            // Guarded already by the lock at share-creation time, so this is
            // belt-and-suspenders, not an expected path.
            throw new ConflictError("A drink in this share no longer has enough left");
          }

          const childAmount = round2(sale.unitPrice * item.quantity);
          const remainingAmount = sale.totalAmount - childAmount;
          const remainingQuantity = sale.quantity - item.quantity;

          sale.quantity = remainingQuantity;
          sale.totalAmount = remainingAmount;
          sale.pendingShare = null;
          await sale.save(opts);

          const createdChild = await SaleModel.create(
            [buildChildData(share.salesContext, sale, share.toUser, item.quantity, childAmount)],
            opts
          );
          item.resultingSale = createdChild[0]._id;
        }
      }

      share.status = "accepted";
    } else {
      await SaleModel.updateMany(
        { _id: { $in: saleIdsOf(share) }, pendingShare: share._id },
        { $set: { pendingShare: null } },
        opts
      );
      share.status = "declined";
    }

    share.respondedAt = new Date();
    await share.save(opts);

    // Populated for the same reason createShare's return is — the push
    // notification on accept/decline needs a real name for its title.
    await share.populate([
      { path: "fromUser", select: "firstName lastName username" },
      { path: "toUser", select: "firstName lastName username" },
    ]);
    const [populated] = await attachSaleDetails(share);
    return populated;
  });
};

const cancelShare = async ({ shareId, userId }) => {
  if (!isValidId(shareId)) throw new NotFoundError("Share not found");

  await expireDueShares({ _id: shareId });

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};
    const share = await BeverageShare.findById(shareId, null, opts);
    if (!share) throw new NotFoundError("Share not found");

    if (String(share.fromUser) !== String(userId)) {
      throw new ForbiddenError("Not authorized to cancel this share");
    }
    if (share.status !== "pending") {
      throw new ConflictError(`This share was already ${share.status}`);
    }

    await SaleModelFor(share.salesContext).updateMany(
      { _id: { $in: saleIdsOf(share) }, pendingShare: share._id },
      { $set: { pendingShare: null } },
      opts
    );
    share.status = "cancelled";
    share.respondedAt = new Date();
    await share.save(opts);

    const [populated] = await attachSaleDetails(share);
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
};
