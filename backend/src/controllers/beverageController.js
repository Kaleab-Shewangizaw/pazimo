const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Beverage = require("../models/Beverage");
const OrganizerBeverageProfile = require("../models/OrganizerBeverageProfile");
const User = require("../models/User");
const Event = require("../models/Event");
const EventBeverage = require("../models/EventBeverage");
const Ticket = require("../models/Ticket");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");
const HappyHour = require("../models/HappyHour");
const { getCampaignState, resolveLineupHappyHour } = require("../utils/happyHour");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

// ---------------------------------------------------------------------------
// Input helpers — same normalisation categoryController uses, kept local to the
// controller because multipart bodies arrive as strings ("true", "12.50") and
// have to be coerced before they reach the schema.
// ---------------------------------------------------------------------------

const normalizeText = (value) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseBoolean = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
};

// Best-effort cleanup of a replaced/deleted local upload. Never throws: a
// leftover file is untidy, a failed request because of one is worse.
const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;

  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove beverage image:", error.message);
    }
  });
};

// Returns undefined for "not supplied" and null for "explicitly cleared", so an
// update can tell the two apart. Normalised to lowercase because the schema's
// match is lowercase-only and a picker may hand back #1F7A3F.
const parseColor = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    throw new BadRequestError("color must be a hex value like #1f7a3f");
  }
  return value.trim().toLowerCase();
};

// The catalogue category (B3). Rejected rather than silently defaulted on a bad
// value: an admin who typed "snacks" needs to be told, not have it quietly
// filed as a drink and reported in the wrong group forever.
const CATEGORIES = ["drink", "snack", "combo"];
const parseCategory = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!CATEGORIES.includes(normalized)) {
    throw new BadRequestError(`category must be one of: ${CATEGORIES.join(", ")}`);
  }
  return normalized;
};

const duplicateNameError = (error) =>
  error?.code === 11000 ? new BadRequestError("A beverage with this name already exists") : error;

// The set of drinks a given profile may sell. Empty blocks means the whole
// active catalogue — see OrganizerBeverageProfile.
const sellableQuery = (profile) => {
  const blocked = profile?.blockedBeverages || [];
  const query = { isActive: true };
  if (blocked.length > 0) query._id = { $nin: blocked };
  return query;
};

const getOrCreateProfile = async (organizerId) => {
  let profile = await OrganizerBeverageProfile.findOne({ organizer: organizerId });
  if (!profile) {
    profile = await OrganizerBeverageProfile.create({ organizer: organizerId });
  }
  return profile;
};

// ---------------------------------------------------------------------------
// Admin — beverage catalogue
// ---------------------------------------------------------------------------

const listBeverages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    // Lets the catalogue screen show drinks, snacks and combos apart, which is
    // the whole point of the category existing.
    if (req.query.category) query.category = parseCategory(req.query.category);

    const [beverages, total, activeCount, inactiveCount] = await Promise.all([
      Beverage.find(query).sort("name").skip(skip).limit(Number(limit)).lean(),
      Beverage.countDocuments(query),
      Beverage.countDocuments({ isActive: true }),
      Beverage.countDocuments({ isActive: false }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: beverages,
      stats: { active: activeCount, inactive: inactiveCount, total: activeCount + inactiveCount },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing beverages:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list beverages",
      error: error.message,
    });
  }
};

const getBeverage = async (req, res) => {
  try {
    const beverage = await Beverage.findById(req.params.id);
    if (!beverage) throw new NotFoundError("Beverage not found");

    res.status(StatusCodes.OK).json({ success: true, data: beverage });
  } catch (error) {
    console.error("Error getting beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createBeverage = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Beverage name is required");

    const beverage = await Beverage.create({
      name,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      color: parseColor(req.body.color) ?? null,
      category: parseCategory(req.body.category) ?? "drink",
      isActive: parseBoolean(req.body.isActive, true),
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: beverage });
  } catch (error) {
    console.error("Error creating beverage:", error);
    // The upload already landed on disk before validation ran — don't leave it
    // behind for a beverage that was never created.
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateBeverage = async (req, res) => {
  try {
    const beverage = await Beverage.findById(req.params.id);
    if (!beverage) throw new NotFoundError("Beverage not found");

    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("Beverage name cannot be empty");
    }
    if (name) beverage.name = name;

    beverage.isActive = parseBoolean(req.body.isActive, beverage.isActive);

    const color = parseColor(req.body.color);
    if (color !== undefined) beverage.color = color;

    const category = parseCategory(req.body.category);
    if (category !== undefined) beverage.category = category;

    const previousImage = beverage.image;
    if (req.file) beverage.image = `/uploads/${req.file.filename}`;

    beverage.updatedBy = req.user.userId;
    await beverage.save();

    if (req.file && previousImage && previousImage !== beverage.image) {
      removeUploadedImage(previousImage);
    }

    res.status(StatusCodes.OK).json({ success: true, data: beverage });
  } catch (error) {
    console.error("Error updating beverage:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

// Dedicated activate/deactivate endpoint so the list can toggle a beverage
// without resubmitting the whole (multipart) form.
const setBeverageStatus = async (req, res) => {
  try {
    const isActive = parseBoolean(req.body.isActive, undefined);
    if (isActive === undefined) {
      throw new BadRequestError("isActive must be true or false");
    }

    const beverage = await Beverage.findById(req.params.id);
    if (!beverage) throw new NotFoundError("Beverage not found");

    beverage.isActive = isActive;
    beverage.updatedBy = req.user.userId;
    await beverage.save();

    res.status(StatusCodes.OK).json({ success: true, data: beverage });
  } catch (error) {
    console.error("Error updating beverage status:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Hard delete, matching how categories are removed. Once event-level selections
// exist this must first refuse to delete a beverage that any EventBeverage row
// still references (deactivating is the non-destructive alternative already).
const deleteBeverage = async (req, res) => {
  try {
    const beverage = await Beverage.findByIdAndDelete(req.params.id);
    if (!beverage) throw new NotFoundError("Beverage not found");

    // Drop it from every organizer's block list too. A dangling id would block
    // nothing, but it would inflate the "N blocked" count an admin sees.
    await OrganizerBeverageProfile.updateMany(
      { blockedBeverages: beverage._id },
      { $pull: { blockedBeverages: beverage._id } }
    );

    removeUploadedImage(beverage.image);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Beverage deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Admin — organizer eligibility
// ---------------------------------------------------------------------------

const listOrganizersForBeverages = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, eligibility } = req.query;
    const skip = (page - 1) * limit;

    const query = { role: "organizer" };
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
    }

    // "Eligible organizers" tab: restrict to organizers whose beverage profile
    // carries that eligibility. Organizers with no profile row default to
    // not_eligible, so an $in on the matching profiles' ids is enough for the
    // eligible filter — the not_eligible filter additionally has to keep the
    // profile-less organizers, hence the $nin form.
    if (eligibility === "eligible") {
      const profiles = await OrganizerBeverageProfile.find({
        eligibility: "eligible",
      }).select("organizer");
      query._id = { $in: profiles.map((p) => p.organizer) };
    } else if (eligibility === "not_eligible") {
      const profiles = await OrganizerBeverageProfile.find({
        eligibility: "eligible",
      }).select("organizer");
      query._id = { $nin: profiles.map((p) => p.organizer) };
    }

    const [organizers, total] = await Promise.all([
      User.find(query)
        .select("firstName lastName email phoneNumber createdAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // One query for the whole page instead of a lazy get-or-create per row:
    // listing organizers is a read, and must not write a profile row for every
    // organizer an admin happens to scroll past.
    const profiles = await OrganizerBeverageProfile.find({
      organizer: { $in: organizers.map((o) => o._id) },
    }).lean();
    const profileByOrganizer = new Map(
      profiles.map((p) => [p.organizer.toString(), p])
    );

    const enriched = organizers.map((organizer) => {
      const profile = profileByOrganizer.get(organizer._id.toString());
      return {
        ...organizer,
        eligibility: profile?.eligibility || "not_eligible",
        eligibilitySetAt: profile?.eligibilitySetAt || null,
        eligibilityNotes: profile?.eligibilityNotes || null,
        // Empty means "no restrictions" — see OrganizerBeverageProfile.
        blockedBeverages: (profile?.blockedBeverages || []).map(String),
      };
    });

    const eligibleCount = await OrganizerBeverageProfile.countDocuments({
      eligibility: "eligible",
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: enriched,
      stats: { eligible: eligibleCount },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing organizers for beverages:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list organizers",
      error: error.message,
    });
  }
};

const setEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { eligibility, notes } = req.body;

    if (!["eligible", "not_eligible"].includes(eligibility)) {
      throw new BadRequestError("eligibility must be 'eligible' or 'not_eligible'");
    }

    const organizer = await User.findOne({ _id: id, role: "organizer" });
    if (!organizer) throw new NotFoundError("Organizer not found");

    const profile = await getOrCreateProfile(id);
    profile.eligibility = eligibility;
    profile.eligibilitySetBy = req.user.userId;
    profile.eligibilitySetAt = new Date();
    if (notes !== undefined) profile.eligibilityNotes = notes;
    await profile.save();

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error setting beverage eligibility:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Blocks an organizer from specific drinks. An empty array clears every block
// and puts them back on the whole active catalogue.
const setBlockedBeverages = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockedBeverageIds } = req.body;

    if (!Array.isArray(blockedBeverageIds)) {
      throw new BadRequestError("blockedBeverageIds must be an array");
    }

    const organizer = await User.findOne({ _id: id, role: "organizer" });
    if (!organizer) throw new NotFoundError("Organizer not found");

    const unique = [...new Set(blockedBeverageIds.map((value) => String(value)))];
    if (unique.some((value) => !mongoose.Types.ObjectId.isValid(value))) {
      throw new BadRequestError("blockedBeverageIds must contain valid beverage ids");
    }

    // Reject ids that don't resolve to a real beverage rather than storing a
    // block that can never match anything.
    if (unique.length > 0) {
      const found = await Beverage.countDocuments({ _id: { $in: unique } });
      if (found !== unique.length) {
        throw new BadRequestError("One or more of those beverages no longer exist");
      }
    }

    const profile = await getOrCreateProfile(id);
    profile.blockedBeverages = unique;
    profile.blockedBeveragesSetBy = req.user.userId;
    profile.blockedBeveragesSetAt = new Date();
    await profile.save();

    res.status(StatusCodes.OK).json({ success: true, data: profile });
  } catch (error) {
    console.error("Error setting blocked beverages:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Organizer
// ---------------------------------------------------------------------------

const getMyEligibility = async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.userId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { eligibility: profile.eligibility },
    });
  } catch (error) {
    console.error("Error getting beverage eligibility:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get eligibility",
    });
  }
};

// The catalogue an eligible organizer may pick from.
const listActiveBeverages = async (req, res) => {
  try {
    const beverages = await Beverage.find(sellableQuery(req.beverageProfile))
      .select("name image color")
      .sort("name")
      .lean();

    res.status(StatusCodes.OK).json({ success: true, data: beverages });
  } catch (error) {
    console.error("Error listing active beverages:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list beverages",
    });
  }
};


// ---------------------------------------------------------------------------
// An event's beverage line-up — reached by the owning organizer and by admins
// ---------------------------------------------------------------------------

// Resolves the event and the permissions that apply to it. Admins reach any
// event and carry the *organizer's* profile, so the same permission rules are
// applied no matter who is editing; an organizer only ever reaches their own.
//
// A missing event and someone else's event are deliberately answered the same
// way for organizers: probing ids should not reveal which events exist.
const resolveEventContext = async (req) => {
  const { eventId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new NotFoundError("Event not found");
  }

  if (req.user.role === "admin") {
    const event = await Event.findById(eventId).select(
      "_id title startDate status organizer"
    );
    if (!event) throw new NotFoundError("Event not found");
    const profile = await OrganizerBeverageProfile.findOne({ organizer: event.organizer });
    return { event, profile };
  }

  const event = await Event.findOne({ _id: eventId, organizer: req.user.userId }).select(
    "_id title startDate status organizer"
  );
  if (!event) throw new NotFoundError("Event not found");
  return { event, profile: req.beverageProfile };
};

// Re-checks the drink against this organizer's permissions on the server. The
// UI already filters the picker, but the block list is the real gate and a
// request can be crafted by hand.
const findSellableBeverage = async (beverageId, profile) => {
  if (!mongoose.Types.ObjectId.isValid(beverageId)) {
    throw new BadRequestError("A valid beverageId is required");
  }
  const beverage = await Beverage.findById(beverageId);
  if (!beverage) throw new NotFoundError("Beverage not found");
  if (!beverage.isActive) {
    throw new BadRequestError("That beverage is not available to sell");
  }
  const blocked = (profile?.blockedBeverages || []).map(String);
  if (blocked.includes(beverage._id.toString())) {
    throw new BadRequestError("You are not permitted to sell that beverage");
  }
  return beverage;
};

const parseStock = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError("stockTotal must be a whole number of at least 1");
  }
  return parsed;
};

const parsePrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError("price must be a number greater than 0");
  }
  return Math.round(parsed * 100) / 100;
};

const listEventBeverages = async (req, res) => {
  try {
    const { event, profile } = await resolveEventContext(req);

    const rows = await EventBeverage.find({ event: event._id })
      .populate("beverage", "name image color isActive")
      .sort("createdAt")
      .lean();

    // A drink can be deactivated or blocked after it was added. The row stays,
    // but the organizer needs to see that it will not be sold, so each one
    // carries why it is currently unsellable rather than silently disappearing.
    const blocked = (profile?.blockedBeverages || []).map(String);
    const now = new Date();
    const happyHours = await HappyHour.find({ event: event._id, cancelledAt: null }).lean();
    const data = rows.map((row) => ({
      ...row,
      remaining: Math.max((row.stockTotal || 0) - (row.sold || 0), 0),
      happyHourStatus: resolveLineupHappyHour(happyHours, row._id, now),
      unavailableReason: !row.beverage
        ? "removed"
        : !row.beverage.isActive
        ? "inactive"
        : blocked.includes(row.beverage._id.toString())
        ? "blocked"
        : null,
    }));

    res.status(StatusCodes.OK).json({
      success: true,
      data,
      event: { _id: event._id, title: event.title, startDate: event.startDate, status: event.status },
      // Admins edit events belonging to organizers whose approval can be
      // revoked independently; the UI needs to say so rather than just
      // failing on save.
      organizerEligibility: profile?.eligibility || "not_eligible",
    });
  } catch (error) {
    console.error("Error listing event beverages:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// The drinks an admin can add to this particular event: the active catalogue
// minus whatever its organizer is blocked from. Keeps the admin's picker
// identical to the organizer's rather than reimplementing the rules client-side.
const listEventSellableCatalog = async (req, res) => {
  try {
    const { profile } = await resolveEventContext(req);

    const beverages = await Beverage.find(sellableQuery(profile))
      .select("name image color")
      .sort("name")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: beverages,
      organizerEligibility: profile?.eligibility || "not_eligible",
    });
  } catch (error) {
    console.error("Error listing sellable catalogue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const addEventBeverage = async (req, res) => {
  try {
    const { event, profile } = await resolveEventContext(req);

    // Organizer routes are already behind requireBeverageEligible; this catches
    // the admin path, so an admin can never set up sales for an organizer who
    // was never approved (or whose approval they just revoked).
    if (!profile || profile.eligibility !== "eligible") {
      throw new BadRequestError(
        "This organizer is not approved to sell beverages. Grant approval first."
      );
    }

    const beverage = await findSellableBeverage(req.body.beverageId, profile);
    const price = parsePrice(req.body.price);
    const stockTotal = parseStock(req.body.stockTotal);

    const row = await EventBeverage.create({
      stockTotal,
      event: event._id,
      // Always the event's owner, never the caller: an admin adding a drink is
      // acting on the organizer's behalf.
      organizer: event.organizer,
      beverage: beverage._id,
      price,
    });

    const populated = await EventBeverage.findById(row._id).populate(
      "beverage",
      "name image color isActive"
    );

    res.status(StatusCodes.CREATED).json({ success: true, data: populated });
  } catch (error) {
    console.error("Error adding event beverage:", error);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("That beverage is already on this event")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateEventBeverage = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);

    // Scoped to the event from the URL so an id belonging to another event
    // cannot be edited through this route.
    const row = await EventBeverage.findOne({ _id: req.params.id, event: event._id });
    if (!row) throw new NotFoundError("That beverage is not on this event");

    if (req.body.price !== undefined) row.price = parsePrice(req.body.price);

    if (req.body.stockTotal !== undefined) {
      const stockTotal = parseStock(req.body.stockTotal);
      // Stock can be topped up or trimmed, but never below what has already
      // been sold — that would make remaining stock negative and imply bottles
      // that were paid for do not exist.
      if (stockTotal < row.sold) {
        throw new BadRequestError(
          `${row.sold} already sold, so stock cannot be set below ${row.sold}`
        );
      }
      row.stockTotal = stockTotal;
    }
    if (req.body.isAvailable !== undefined) {
      const isAvailable = parseBoolean(req.body.isAvailable, undefined);
      if (isAvailable === undefined) {
        throw new BadRequestError("isAvailable must be true or false");
      }
      row.isAvailable = isAvailable;
    }
    await row.save();

    const populated = await EventBeverage.findById(row._id).populate(
      "beverage",
      "name image color isActive"
    );

    res.status(StatusCodes.OK).json({ success: true, data: populated });
  } catch (error) {
    console.error("Error updating event beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Happy hour — a campaign: pick one or more drinks already on this event,
// price each, publish. One shared duration/start governs every drink in it.
//
// Status ("scheduled"/"active"/"ended") is never stored; see
// utils/happyHour.js. What IS stored (models/HappyHour.js) is only what an
// organizer actually decided: which drinks, at what price, for how long,
// starting how.
// ---------------------------------------------------------------------------

// Pushes a live update to everyone currently browsing this event's drinks
// (see server.js's "subscribeBeverages" join). Best-effort, same reasoning
// as ticketShareController.notifyUser — a socket push failing must never
// fail the HTTP request that triggered it.
const notifyEventBeverageRoom = (req, eventId, event, payload) => {
  try {
    const io = req.app.get("io");
    if (io) io.to(`event_${eventId}_beverages`).emit(event, payload);
  } catch (error) {
    console.error(`Failed to emit ${event} to event ${eventId}:`, error.message);
  }
};

const parseHappyHourTiming = (body) => {
  const durationMinutes = Number(body.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    throw new BadRequestError("durationMinutes must be a whole number of at least 1");
  }
  const startMode = body.startMode;
  if (!["manual", "scheduled"].includes(startMode)) {
    throw new BadRequestError('startMode must be "manual" or "scheduled"');
  }
  let scheduledStartAt;
  if (startMode === "scheduled") {
    scheduledStartAt = new Date(body.scheduledStartAt);
    if (Number.isNaN(scheduledStartAt.getTime())) {
      throw new BadRequestError("A valid scheduledStartAt is required for a scheduled happy hour");
    }
    if (scheduledStartAt <= new Date()) {
      throw new BadRequestError("scheduledStartAt must be in the future");
    }
  }
  return { durationMinutes, startMode, scheduledStartAt };
};

/**
 * A drink can only be in one live happy hour at a time — otherwise "which
 * price wins" has no clean answer. Checked against every non-cancelled
 * campaign for this event whose window hasn't ended yet.
 */
const assertNoOverlap = async (eventId, lineupIds, now = new Date()) => {
  const candidates = await HappyHour.find({
    event: eventId,
    cancelledAt: null,
    "items.lineup": { $in: lineupIds },
  }).lean();

  for (const candidate of candidates) {
    const state = getCampaignState(candidate, now);
    if (state.status !== "active" && state.status !== "scheduled") continue;
    const clashing = candidate.items.find((item) =>
      lineupIds.some((id) => String(id) === String(item.lineup))
    );
    if (clashing) {
      throw new BadRequestError(
        `One of these drinks is already in a ${state.status} happy hour — cancel it first`
      );
    }
  }
};

const listEventHappyHours = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);
    const campaigns = await HappyHour.find({ event: event._id }).sort("-createdAt").lean();

    const lineupIds = [...new Set(campaigns.flatMap((c) => c.items.map((i) => String(i.lineup))))];
    const lineupById = new Map(
      (
        await EventBeverage.find({ _id: { $in: lineupIds } })
          .populate("beverage", "name color")
          .lean()
      ).map((l) => [String(l._id), l])
    );

    const now = new Date();
    const data = campaigns.map((campaign) => ({
      ...campaign,
      state: getCampaignState(campaign, now),
      items: campaign.items.map((item) => ({
        ...item,
        beverage: lineupById.get(String(item.lineup))?.beverage || null,
        regularPrice: lineupById.get(String(item.lineup))?.price ?? null,
      })),
    }));

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error listing event happy hours:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createEventHappyHour = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!rawItems.length) throw new BadRequestError("Pick at least one drink");

    const lineupIds = rawItems.map((i) => String(i.eventBeverageId || i.id || ""));
    if (lineupIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new BadRequestError("One or more drinks are invalid");
    }

    const rows = await EventBeverage.find({ _id: { $in: lineupIds }, event: event._id });
    if (rows.length !== new Set(lineupIds).size) {
      throw new BadRequestError("One or more drinks are not on this event");
    }
    const rowById = new Map(rows.map((r) => [String(r._id), r]));

    const items = rawItems.map((raw) => {
      const id = String(raw.eventBeverageId || raw.id);
      const row = rowById.get(id);
      const price = parsePrice(raw.price);
      if (price >= row.price) {
        throw new BadRequestError(
          `${price} isn't lower than ${row.price} for that drink's regular price`
        );
      }
      return { lineup: row._id, price };
    });

    await assertNoOverlap(event._id, items.map((i) => i.lineup));

    const timing = parseHappyHourTiming(req.body);

    const campaign = await HappyHour.create({
      scope: "EVENT",
      event: event._id,
      organizer: event.organizer,
      items,
      ...timing,
      createdBy: req.user.userId,
    });

    if (timing.startMode === "scheduled") {
      notifyEventBeverageRoom(req, event._id, "happyHour:scheduled", {
        happyHourId: campaign._id,
        scheduledStartAt: timing.scheduledStartAt,
      });
    }

    res.status(StatusCodes.CREATED).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error creating event happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const startEventHappyHour = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);
    const campaign = await HappyHour.findOne({ _id: req.params.id, event: event._id });
    if (!campaign) throw new NotFoundError("Happy hour not found");

    if (campaign.startMode !== "manual") {
      throw new BadRequestError("This happy hour starts automatically, not manually");
    }
    if (campaign.cancelledAt) throw new BadRequestError("This happy hour was cancelled");
    if (campaign.startedAt) throw new BadRequestError("This happy hour was already started");

    campaign.startedAt = new Date();
    await campaign.save();

    const state = getCampaignState(campaign);
    notifyEventBeverageRoom(req, event._id, "happyHour:started", {
      happyHourId: campaign._id,
      endsAt: state.endsAt,
      items: campaign.items,
    });

    res.status(StatusCodes.OK).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error starting event happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const cancelEventHappyHour = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);
    const campaign = await HappyHour.findOne({ _id: req.params.id, event: event._id });
    if (!campaign) throw new NotFoundError("Happy hour not found");
    if (campaign.cancelledAt) throw new BadRequestError("This happy hour was already cancelled");

    campaign.cancelledAt = new Date();
    await campaign.save();

    notifyEventBeverageRoom(req, event._id, "happyHour:cancelled", {
      happyHourId: campaign._id,
    });

    res.status(StatusCodes.OK).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error cancelling event happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const removeEventBeverage = async (req, res) => {
  try {
    const { event } = await resolveEventContext(req);

    const existing = await EventBeverage.findOne({ _id: req.params.id, event: event._id });
    if (!existing) throw new NotFoundError("That beverage is not on this event");

    // Deleting a row that has sales behind it would orphan the ledger and lose
    // the record of what people paid for. Withdrawing it from sale is the
    // reversible action; deletion is only for a line that never sold.
    if (existing.sold > 0) {
      throw new BadRequestError(
        `${existing.sold} already sold, so this drink can't be removed. Use "Stop selling" instead.`
      );
    }

    const row = await EventBeverage.findOneAndDelete({
      _id: req.params.id,
      event: event._id,
    });
    if (!row) throw new NotFoundError("That beverage is not on this event");

    res.status(StatusCodes.OK).json({ success: true, message: "Beverage removed from the event" });
  } catch (error) {
    console.error("Error removing event beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Customer refill routes — browsing only, nothing here takes a payment yet.
// A signed-in customer sees only events they hold a valid, paid ticket for;
// `listEventBeverages` above (the organizer/admin version) is a different
// route with different authorization, not reused directly here because its
// gate is ownership, not ticket-holding.
// ---------------------------------------------------------------------------

const VALID_TICKET_FILTER = {
  status: "active",
  paymentStatus: "completed",
  ticketCount: { $gt: 0 },
};

const listRefillEvents = async (req, res) => {
  try {
    const eventIds = await Ticket.distinct("event", {
      user: req.user.userId,
      ...VALID_TICKET_FILTER,
    });
    if (!eventIds.length) {
      return res.status(StatusCodes.OK).json({ success: true, data: [] });
    }

    // `isAvailable`/`isActive` both default to true, and a query filter does
    // not apply schema defaults to documents where the field was never set —
    // `!== false` is what actually honours "true unless explicitly turned off".
    const rows = await EventBeverage.find({
      event: { $in: eventIds },
      isAvailable: { $ne: false },
    })
      .select("event beverage stockTotal sold")
      .populate("beverage", "isActive")
      .lean();

    const countByEvent = new Map();
    for (const row of rows) {
      // No populated beverage means the catalogue row it pointed at was deleted.
      if (!row.beverage || row.beverage.isActive === false) continue;
      if ((row.stockTotal || 0) - (row.sold || 0) <= 0) continue;
      const key = String(row.event);
      countByEvent.set(key, (countByEvent.get(key) || 0) + 1);
    }
    if (!countByEvent.size) {
      return res.status(StatusCodes.OK).json({ success: true, data: [] });
    }

    const events = await Event.find({ _id: { $in: [...countByEvent.keys()] } })
      .select("title startDate coverImages")
      .lean();

    const data = events.map((event) => ({
      eventId: event._id,
      title: event.title,
      startDate: event.startDate,
      coverImages: event.coverImages,
      beverageCount: countByEvent.get(String(event._id)) || 0,
    }));

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error listing refill events:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const getEventRefillCatalog = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new NotFoundError("Event not found");
    }

    const event = await Event.findById(eventId).select("_id title startDate organizer");
    if (!event) throw new NotFoundError("Event not found");

    const hasValidTicket = await Ticket.exists({
      event: eventId,
      user: req.user.userId,
      ...VALID_TICKET_FILTER,
    });
    if (!hasValidTicket) {
      throw new ForbiddenError("You need a ticket to this event to buy drinks here");
    }

    const profile = await OrganizerBeverageProfile.findOne({ organizer: event.organizer });
    const blocked = (profile?.blockedBeverages || []).map(String);

    const rows = await EventBeverage.find({ event: event._id, isAvailable: { $ne: false } })
      .populate("beverage", "name image color isActive")
      .lean();

    const now = new Date();
    const happyHours = await HappyHour.find({ event: event._id, cancelledAt: null }).lean();
    const data = rows
      .filter(
        (row) =>
          row.beverage &&
          row.beverage.isActive !== false &&
          !blocked.includes(String(row.beverage._id)),
      )
      .map((row) => {
        const happyHour = resolveLineupHappyHour(happyHours, row._id, now);
        return {
          id: row._id,
          beverageId: row.beverage._id,
          name: row.beverage.name,
          image: row.beverage.image,
          color: row.beverage.color,
          // What a purchase right now actually costs — the happy-hour price
          // while one is active, otherwise the regular price. regularPrice is
          // still sent so the app can show a struck-through "was" price.
          price: happyHour.status === "active" ? happyHour.price : row.price,
          regularPrice: row.price,
          currency: row.currency,
          remaining: Math.max((row.stockTotal || 0) - (row.sold || 0), 0),
          happyHour,
        };
      })
      .filter((item) => item.remaining > 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data,
      event: { _id: event._id, title: event.title, startDate: event.startDate },
    });
  } catch (error) {
    console.error("Error listing event refill catalog:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  listBeverages,
  getBeverage,
  createBeverage,
  updateBeverage,
  setBeverageStatus,
  deleteBeverage,
  listOrganizersForBeverages,
  setEligibility,
  setBlockedBeverages,
  getMyEligibility,
  listActiveBeverages,
  listEventBeverages,
  listEventSellableCatalog,
  addEventBeverage,
  updateEventBeverage,
  removeEventBeverage,
  listEventHappyHours,
  createEventHappyHour,
  startEventHappyHour,
  cancelEventHappyHour,
  listRefillEvents,
  getEventRefillCatalog,
};
