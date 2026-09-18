const { StatusCodes } = require("http-status-codes");
const User = require("../models/User");
const Event = require("../models/Event");
const EventUsherCode = require("../models/EventUsherCode");
const UsherEventAccess = require("../models/UsherEventAccess");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");

// An admin- or organizer-owned event can manage its own ushers; nobody else
// can, regardless of role. Same rule eventController.updateEvent already
// enforces for editing the event itself.
const assertCanManageEvent = (event, req) => {
  const isOwner = event.organizer && event.organizer.toString() === req.user.userId;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new UnauthorizedError("Not authorized to manage ushers for this event");
  }
};

// POST /api/ushers — admin only. Ushers don't self-register: an account has
// to exist before anyone can hand its holder an event code.
const createUsher = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;

  if (!firstName || !email || !phoneNumber || !password) {
    throw new BadRequestError(
      "firstName, email, phoneNumber and password are required"
    );
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
    role: "usher",
    createdBy: req.user.userId,
    createdByModel: req.user.role === "admin" ? "Admin" : "User",
  });
  user.password = undefined;

  res.status(StatusCodes.CREATED).json({
    status: "success",
    data: { user },
  });
};

// POST /api/ushers/events/:eventId/code — admin or the event's own organizer.
// Generates a fresh code, overwriting whatever code existed before. Existing
// UsherEventAccess grants are untouched — rotating the code stops new
// redemptions, it doesn't revoke anyone already let in (use the revoke
// endpoint for that).
const generateEventCode = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  let code;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = EventUsherCode.generateCode();
    const collision = await EventUsherCode.findOne({
      code: candidate,
      event: { $ne: event._id },
    });
    if (!collision) code = candidate;
  }
  if (!code) {
    throw new BadRequestError("Could not generate a unique code — try again");
  }

  const generatedByModel = req.user.role === "admin" ? "Admin" : "User";
  const eventCode = await EventUsherCode.findOneAndUpdate(
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

// GET /api/ushers/events/:eventId/code — admin or the event's own organizer.
// Current code (null if none generated yet) plus everyone currently holding
// a live grant, for the "who can scan this event" view.
const getEventUsherAccess = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  const [eventCode, grants] = await Promise.all([
    EventUsherCode.findOne({ event: event._id }).select("code updatedAt"),
    UsherEventAccess.find({ event: event._id, revokedAt: null })
      .populate("usher", "firstName lastName email phoneNumber")
      .sort({ grantedAt: -1 }),
  ]);

  res.status(StatusCodes.OK).json({
    status: "success",
    data: {
      code: eventCode?.code || null,
      codeUpdatedAt: eventCode?.updatedAt || null,
      ushers: grants
        .filter((grant) => grant.usher)
        .map((grant) => ({
          accessId: grant._id,
          usher: grant.usher,
          grantedAt: grant.grantedAt,
        })),
    },
  });
};

// PATCH /api/ushers/events/:eventId/access/:usherId/revoke — admin or the
// event's own organizer. Idempotent-ish: 404s if there's no live grant to
// revoke rather than silently no-op'ing, so the caller isn't left thinking a
// revoke landed when the usher never had access (or had it revoked already).
const revokeUsherAccess = async (req, res) => {
  const event = await Event.findById(req.params.eventId).select("organizer");
  if (!event) throw new NotFoundError("Event not found");
  assertCanManageEvent(event, req);

  const access = await UsherEventAccess.findOneAndUpdate(
    { event: event._id, usher: req.params.usherId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );
  if (!access) {
    throw new NotFoundError(
      "This usher does not have active access to this event"
    );
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: { accessId: access._id, revokedAt: access.revokedAt },
  });
};

// POST /api/ushers/unlock-event — usher only. Redeeming the same code twice,
// or redeeming again after a revoke, both just (re)activate one grant rather
// than erroring or piling up duplicates.
const unlockEvent = async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) throw new BadRequestError("Enter the event code");

  const eventCode = await EventUsherCode.findOne({ code }).populate(
    "event",
    "title startDate endDate location status coverImages organizer"
  );
  if (!eventCode || !eventCode.event) {
    throw new NotFoundError("Invalid code");
  }
  if (eventCode.event.status === "cancelled") {
    throw new BadRequestError("This event has been cancelled");
  }

  // An usher scans one event at a time, never several concurrently — so
  // unlocking a new one revokes every other grant this account still holds
  // before creating it. Excludes this event itself: redeeming the same
  // event's code again (e.g. after a re-login) just refreshes that grant
  // instead of pointlessly revoking-then-recreating it.
  await UsherEventAccess.updateMany(
    {
      usher: req.user.userId,
      event: { $ne: eventCode.event._id },
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );

  const access = await UsherEventAccess.findOneAndUpdate(
    { usher: req.user.userId, event: eventCode.event._id },
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

// GET /api/ushers/my-events — usher only. At most one live grant per usher
// (unlockEvent revokes any other on redeem), so this is a 0-or-1-element
// list in practice; kept as a list rather than a single nullable object so
// the shape doesn't have to change if that ever loosens.
const getMyEvents = async (req, res) => {
  const grants = await UsherEventAccess.find({
    usher: req.user.userId,
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
  createUsher,
  generateEventCode,
  getEventUsherAccess,
  revokeUsherAccess,
  unlockEvent,
  getMyEvents,
};
