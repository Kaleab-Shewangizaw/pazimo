const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Event = require("../models/Event");
const EventCashierCode = require("../models/EventCashierCode");
const CashierEventAccess = require("../models/CashierEventAccess");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");

// The event-cashier twin of usherController.js — same event-scoping shape
// (a redeemable code, a per-event grant), for beverage redemption instead of
// ticket check-in. See User.js's role comment for why this account has
// neither `cinema` nor `venue` set.

// An admin- or organizer-owned event can manage its own cashiers; nobody
// else can, regardless of role. Same rule usherController's
// assertCanManageEvent enforces for ushers.
const assertCanManageEvent = (event, req) => {
  const isOwner = event.organizer && event.organizer.toString() === req.user.userId;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new UnauthorizedError("Not authorized to manage cashiers for this event");
  }
};

// POST /api/event-cashiers — admin OR organizer, unlike usher's
// admin-only createUsher: an organizer running its own events can staff its
// own bar without waiting on an admin. Creates a bare login, not yet scoped
// to any event — that happens separately by generating/redeeming a code, so
// the same cashier account can be reassigned across different events over
// time (see redeemEventCode).
const createEventCashier = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  if (!firstName || !email || !phoneNumber || !password) {
    throw new BadRequestError(
      "firstName, email, phoneNumber and password are required"
    );
  }
  if (String(password).length < 6) {
    throw new BadRequestError("Password must be at least 6 characters");
  }

  const existingEmail = await User.findOne({
    email: String(email).toLowerCase().trim(),
  });
  if (existingEmail) {
    throw new BadRequestError("Email already registered");
  }

  const user = await User.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    role: "cashier",
    createdBy: req.user.userId,
    createdByModel: req.user.role === "admin" ? "Admin" : "User",
  });
  user.password = undefined;

  res.status(StatusCodes.CREATED).json({
    status: "success",
    data: { user },
  });
};

// GET /api/event-cashiers — admin OR organizer. Every cashier account scoped
// to events rather than a cinema/venue (cinema.me/cashiers and
// venue/:id/cashiers already list those two separately). An admin sees
// every one of them; an organizer sees only the ones IT created — the same
// "only your own" boundary assertCanManageEvent enforces per-event, applied
// here to the account list instead.
const listEventCashiers = async (req, res) => {
  const query = { role: "cashier", cinema: null, venue: null };
  if (req.user.role !== "admin") {
    query.createdBy = req.user.userId;
  }

  const cashiers = await User.find(query).select("-password").sort("-createdAt");

  res.status(StatusCodes.OK).json({ status: "success", data: { users: cashiers } });
};

// PATCH /api/event-cashiers/:cashierId — admin, or the organizer that
// created this cashier. Soft toggle, not a delete: BeverageSale.redeemedBy
// references this account, same reasoning cinemaCashierController/
// venueCashierController avoid a hard delete for.
const setEventCashierActive = async (req, res) => {
  const query = { _id: req.params.cashierId, role: "cashier", cinema: null, venue: null };
  if (req.user.role !== "admin") {
    query.createdBy = req.user.userId;
  }

  const cashier = await User.findOne(query);
  if (!cashier) throw new NotFoundError("Cashier not found");

  if (req.body.isActive !== undefined) {
    cashier.isActive = req.body.isActive === true || req.body.isActive === "true";
  }
  await cashier.save();
  cashier.password = undefined;

  res.status(StatusCodes.OK).json({ status: "success", data: { user: cashier } });
};

// POST /api/event-cashiers/events/:eventId/code — admin or the event's own
// organizer. Generates a fresh code, overwriting whatever code existed
// before. Existing CashierEventAccess grants are untouched — rotating the
// code stops new redemptions, it doesn't revoke anyone already let in (use
// the revoke endpoint for that).
const generateEventCode = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  let code;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = EventCashierCode.generateCode();
    const collision = await EventCashierCode.findOne({
      code: candidate,
      event: { $ne: event._id },
    });
    if (!collision) code = candidate;
  }
  if (!code) {
    throw new BadRequestError("Could not generate a unique code — try again");
  }

  const generatedByModel = req.user.role === "admin" ? "Admin" : "User";
  const eventCode = await EventCashierCode.findOneAndUpdate(
    { event: event._id },
    {
      $set: {
        code,
        generatedBy: req.user.userId,
        generatedByModel,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(StatusCodes.OK).json({
    status: "success",
    data: { code: eventCode.code },
  });
};

// GET /api/event-cashiers/events/:eventId/code — admin or the event's own
// organizer. Current code (null if none generated yet) plus everyone
// currently holding a live grant, for the "who can redeem this event's
// drinks" view.
const getEventCashierAccess = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  const [eventCode, grants] = await Promise.all([
    EventCashierCode.findOne({ event: event._id }).select("code updatedAt"),
    CashierEventAccess.find({ event: event._id, revokedAt: null })
      .populate("cashier", "firstName lastName email phoneNumber")
      .sort({ grantedAt: -1 }),
  ]);

  res.status(StatusCodes.OK).json({
    status: "success",
    data: {
      code: eventCode?.code || null,
      codeUpdatedAt: eventCode?.updatedAt || null,
      cashiers: grants
        .filter((grant) => grant.cashier)
        .map((grant) => ({
          accessId: grant._id,
          cashier: grant.cashier,
          grantedAt: grant.grantedAt,
        })),
    },
  });
};

// PATCH /api/event-cashiers/events/:eventId/access/:cashierId/revoke —
// admin or the event's own organizer.
const revokeCashierAccess = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  const access = await CashierEventAccess.findOneAndUpdate(
    { event: event._id, cashier: req.params.cashierId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!access) {
    throw new NotFoundError(
      "This cashier does not have active access to this event"
    );
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: { accessId: access._id, revokedAt: access.revokedAt },
  });
};

// POST /api/event-cashiers/unlock-event — cashier only. Redeeming the same
// code twice, or redeeming again after a revoke, both just (re)activate one
// grant rather than erroring or piling up duplicates. A cinema/venue cashier
// (role "cashier" but with `cinema`/`venue` already set) can technically
// call this too — it would just scope it to an event ON TOP of its
// permanent business, which is harmless but not a flow the UI offers; not
// worth a special-case rejection.
const redeemEventCode = async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) throw new BadRequestError("Enter the event code");

  const eventCode = await EventCashierCode.findOne({ code }).populate(
    "event",
    "title startDate endDate location status coverImages organizer"
  );
  if (!eventCode || !eventCode.event) {
    throw new NotFoundError("Invalid code");
  }
  if (eventCode.event.status === "cancelled") {
    throw new BadRequestError("This event has been cancelled");
  }

  // A cashier redeems one event at a time, never several concurrently — so
  // unlocking a new one revokes every other grant this account still holds
  // before creating it. Excludes this event itself: redeeming the same
  // event's code again just refreshes that grant.
  await CashierEventAccess.updateMany(
    {
      cashier: req.user.userId,
      event: { $ne: eventCode.event._id },
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  const access = await CashierEventAccess.findOneAndUpdate(
    { cashier: req.user.userId, event: eventCode.event._id },
    { $set: { revokedAt: null, grantedAt: new Date() } },
    { upsert: true, new: true }
  );

  res.status(StatusCodes.OK).json({
    status: "success",
    data: {
      event: eventCode.event,
      grantedAt: access.grantedAt,
    },
  });
};

// GET /api/event-cashiers/my-events — cashier only. At most one live grant
// (redeemEventCode revokes any other on redeem), so this is a 0-or-1-element
// list in practice; kept as a list rather than a single nullable object so
// the shape doesn't have to change if that ever loosens.
const getMyEvents = async (req, res) => {
  const grants = await CashierEventAccess.find({
    cashier: req.user.userId,
    revokedAt: null,
  })
    .populate("event", "title startDate endDate location status coverImages")
    .sort({ grantedAt: -1 });

  res.status(StatusCodes.OK).json({
    status: "success",
    data: grants
      .filter((grant) => grant.event)
      .map((grant) => ({ event: grant.event, grantedAt: grant.grantedAt })),
  });
};

module.exports = {
  createEventCashier,
  listEventCashiers,
  setEventCashierActive,
  generateEventCode,
  getEventCashierAccess,
  revokeCashierAccess,
  redeemEventCode,
  getMyEvents,
};
