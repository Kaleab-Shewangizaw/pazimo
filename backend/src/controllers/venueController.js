const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Beverage = require("../models/Beverage");
const Venue = require("../models/Venue");
const VenueBeverage = require("../models/VenueBeverage");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");
const HappyHour = require("../models/HappyHour");
const { getCampaignState, resolveLineupHappyHour } = require("../utils/happyHour");
const {
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
  normalizeCommissionRate,
} = require("../config/rates");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

// ---------------------------------------------------------------------------
// Input helpers — the same normalisation beverageController uses, kept local
// because multipart bodies arrive as strings ("true", "12.50") and have to be
// coerced before they reach the schema.
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

const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;

  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove venue image:", error.message);
    }
  });
};

const parsePrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestError("price must be a number greater than 0");
  }
  return Math.round(parsed * 100) / 100;
};

const parseStock = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestError("stockTotal must be a whole number of at least 1");
  }
  return parsed;
};

const duplicateNameError = (error) =>
  error?.code === 11000
    ? new BadRequestError("A venue with this name already exists")
    : error;

// The set of drinks a given venue may sell. Empty blocks means the whole active
// catalogue — the same deny-list rule OrganizerBeverageProfile documents.
const sellableQuery = (venue) => {
  const blocked = venue?.blockedBeverages || [];
  const query = { isActive: true };
  if (blocked.length > 0) query._id = { $nin: blocked };
  return query;
};

/**
 * Resolve the venue a request is acting on, and prove the caller may act on it.
 *
 * The venue-channel twin of beverageController.resolveEventContext, with the
 * same two rules:
 *
 *  - an admin reaches any venue;
 *  - a venue account reaches only the venue it owns, and a missing venue and
 *    someone else's venue are answered identically, so probing ids never
 *    reveals which venues exist.
 *
 * Ownership is re-derived from the database here on every call rather than
 * trusted from a parameter, which is what stops one venue editing another's
 * line-up by changing the id in the URL.
 */
const resolveVenueContext = async (req) => {
  const venueId = req.params.venueId || req.params.id;

  if (req.user.role === "admin") {
    if (!mongoose.Types.ObjectId.isValid(venueId)) {
      throw new NotFoundError("Venue not found");
    }
    const venue = await Venue.findById(venueId);
    if (!venue) throw new NotFoundError("Venue not found");
    return venue;
  }

  // Non-admins: req.venue was already resolved from the account by
  // requireVenueAccount. The id in the URL must match it — a venue account
  // asking about a different venue gets the same answer as one asking about a
  // venue that does not exist.
  if (!req.venue) throw new NotFoundError("Venue not found");
  if (venueId && String(req.venue._id) !== String(venueId)) {
    throw new NotFoundError("Venue not found");
  }
  return req.venue;
};

// Re-checks a drink against this venue's permissions on the server. The UI
// already filters the picker, but the block list is the real gate and a request
// can be crafted by hand.
const findSellableBeverage = async (beverageId, venue) => {
  if (!mongoose.Types.ObjectId.isValid(beverageId)) {
    throw new BadRequestError("A valid beverageId is required");
  }
  const beverage = await Beverage.findById(beverageId);
  if (!beverage) throw new NotFoundError("Beverage not found");
  if (!beverage.isActive) {
    throw new BadRequestError("That beverage is not available to sell");
  }
  const blocked = (venue?.blockedBeverages || []).map(String);
  if (blocked.includes(beverage._id.toString())) {
    throw new BadRequestError("This venue is not permitted to sell that beverage");
  }
  return beverage;
};

// ---------------------------------------------------------------------------
// Admin — venue accounts
// ---------------------------------------------------------------------------

const listVenues = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, eligibility, venueType } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.name = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
    if (eligibility === "eligible" || eligibility === "not_eligible") {
      query.eligibility = eligibility;
    }
    if (venueType) query.venueType = venueType;

    const [venues, total, eligibleCount] = await Promise.all([
      Venue.find(query)
        .populate("account", "email phoneNumber firstName isActive")
        .sort("name")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Venue.countDocuments(query),
      Venue.countDocuments({ eligibility: "eligible" }),
    ]);

    // Line-up size and takings for the whole page in one aggregation each,
    // rather than a per-row query — the same shape listBeverageEvents uses.
    const ids = venues.map((v) => v._id);
    const [lineups, sales] = await Promise.all([
      VenueBeverage.aggregate([
        { $match: { venue: { $in: ids } } },
        {
          $group: {
            _id: "$venue",
            drinksOffered: { $sum: 1 },
            stockTotal: { $sum: "$stockTotal" },
            sold: { $sum: "$sold" },
          },
        },
      ]),
      VenueBeverageSale.aggregate([
        { $match: { venue: { $in: ids }, status: "confirmed" } },
        {
          $group: {
            _id: "$venue",
            grossRevenue: { $sum: "$totalAmount" },
            salesCount: { $sum: 1 },
          },
        },
      ]),
    ]);
    const lineupBy = new Map(lineups.map((r) => [String(r._id), r]));
    const salesBy = new Map(sales.map((r) => [String(r._id), r]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: venues.map((venue) => {
        const l = lineupBy.get(String(venue._id)) || {};
        const s = salesBy.get(String(venue._id)) || {};
        return {
          ...venue,
          blockedBeverages: (venue.blockedBeverages || []).map(String),
          drinksOffered: l.drinksOffered || 0,
          stockTotal: l.stockTotal || 0,
          stockSold: l.sold || 0,
          stockRemaining: Math.max((l.stockTotal || 0) - (l.sold || 0), 0),
          grossRevenue: Math.round((s.grossRevenue || 0) * 100) / 100,
          salesCount: s.salesCount || 0,
        };
      }),
      stats: { eligible: eligibleCount, total },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing venues:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list venues",
      error: error.message,
    });
  }
};

const getVenue = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .populate("account", "email phoneNumber firstName isActive")
      .lean();
    if (!venue) throw new NotFoundError("Venue not found");

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error getting venue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Create a venue and, with it, the account that signs in as that venue.
 *
 * Both in one request because a venue with no account cannot be used and an
 * account with no venue has nothing to do — creating them separately would
 * leave an admin one forgotten step away from an unusable half-record.
 *
 * The account is created first: if the venue then fails (a duplicate name, say)
 * the account is removed again below, rather than left orphaned as a login that
 * resolves to no venue.
 */
const createVenue = async (req, res) => {
  let createdAccount = null;
  try {
    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Venue name is required");

    const email = normalizeText(req.body.email)?.toLowerCase();
    const password = req.body.password;
    const phoneNumber = normalizeText(req.body.phoneNumber);

    if (!email) throw new BadRequestError("An account email is required");
    if (!password || String(password).length < 6) {
      throw new BadRequestError("A password of at least 6 characters is required");
    }
    if (!phoneNumber) throw new BadRequestError("A phone number is required");

    const existing = await User.findOne({ email });
    if (existing) {
      throw new BadRequestError("An account with this email already exists");
    }

    createdAccount = await User.create({
      email,
      password,
      // The venue's display name doubles as the account's first name: User
      // requires one, and a venue is a business rather than a person.
      firstName: name,
      phoneNumber,
      role: "venue",
    });

    const venue = await Venue.create({
      account: createdAccount._id,
      name,
      venueType: req.body.venueType || "other",
      city: normalizeText(req.body.city),
      address: normalizeText(req.body.address),
      phoneNumber,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      // Approval is never granted at creation time by default — an admin makes
      // that a separate, deliberate act, exactly as with organizer eligibility.
      eligibility:
        req.body.eligibility === "eligible" ? "eligible" : "not_eligible",
      eligibilitySetBy: req.body.eligibility === "eligible" ? req.user.userId : undefined,
      eligibilitySetAt: req.body.eligibility === "eligible" ? new Date() : undefined,
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { ...venue.toObject(), account: { _id: createdAccount._id, email } },
    });
  } catch (error) {
    console.error("Error creating venue:", error);
    // Roll the account back so a failed create cannot leave a login behind that
    // resolves to no venue — requireVenueAccount would reject it forever.
    if (createdAccount) {
      await User.deleteOne({ _id: createdAccount._id }).catch((cleanupError) =>
        console.error("Failed to roll back venue account:", cleanupError.message)
      );
    }
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateVenue = async (req, res) => {
  try {
    const currentVenue = await Venue.findById(req.params.id)
      .select("account image isActive coversVenueVat")
      .lean();
    if (!currentVenue) throw new NotFoundError("Venue not found");

    const updates = {};
    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("Venue name cannot be empty");
    }
    if (name) updates.name = name;

    if (req.body.venueType !== undefined) updates.venueType = req.body.venueType;
    if (req.body.city !== undefined) updates.city = normalizeText(req.body.city);
    if (req.body.address !== undefined) updates.address = normalizeText(req.body.address);
    if (req.body.phoneNumber !== undefined) {
      updates.phoneNumber = normalizeText(req.body.phoneNumber);
    }
    updates.isActive = parseBoolean(req.body.isActive, currentVenue.isActive);

    // Rates govern FUTURE sales only — every past sale keeps the rate it
    // snapshotted, so changing this never restates money already reported.
    if (req.body.beverageCommissionRate !== undefined) {
      const rate = Number(req.body.beverageCommissionRate);
      if (!Number.isFinite(rate) || rate < MIN_COMMISSION_RATE || rate > MAX_COMMISSION_RATE) {
        throw new BadRequestError(
          `beverageCommissionRate must be between ${MIN_COMMISSION_RATE} and ${MAX_COMMISSION_RATE}`
        );
      }
      updates.beverageCommissionRate = normalizeCommissionRate(rate);
    }
    if (req.body.coversVenueVat !== undefined) {
      updates.coversVenueVat = parseBoolean(req.body.coversVenueVat, currentVenue.coversVenueVat);
    }

    const previousImage = currentVenue.image;
    if (req.file) updates.image = `/uploads/${req.file.filename}`;

    updates.updatedBy = req.user.userId;

    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true, context: "query" }
    );
    if (!venue) throw new NotFoundError("Venue not found");

    // Suspending a venue must also stop its account signing in, or the login
    // would still work and simply fail at every route behind requireVenueAccount.
    if (currentVenue.account) {
      await User.updateOne({ _id: currentVenue.account }, { isActive: updates.isActive });
    }

    if (req.file && previousImage && previousImage !== venue.image) {
      removeUploadedImage(previousImage);
    }

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error updating venue:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const setVenueEligibility = async (req, res) => {
  try {
    const { eligibility, notes } = req.body;
    if (!["eligible", "not_eligible"].includes(eligibility)) {
      throw new BadRequestError("eligibility must be 'eligible' or 'not_eligible'");
    }

    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          eligibility,
          eligibilitySetBy: req.user.userId,
          eligibilitySetAt: new Date(),
          ...(notes !== undefined ? { eligibilityNotes: notes } : {}),
        },
      },
      { new: true, runValidators: true, context: "query" }
    );
    if (!venue) throw new NotFoundError("Venue not found");

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error setting venue eligibility:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// Blocks a venue from specific drinks. An empty array clears every block and
// puts the venue back on the whole active catalogue.
const setVenueBlockedBeverages = async (req, res) => {
  try {
    const { blockedBeverageIds } = req.body;
    if (!Array.isArray(blockedBeverageIds)) {
      throw new BadRequestError("blockedBeverageIds must be an array");
    }

    const venue = await Venue.findById(req.params.id);
    if (!venue) throw new NotFoundError("Venue not found");

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

    venue.blockedBeverages = unique;
    venue.blockedBeveragesSetBy = req.user.userId;
    venue.blockedBeveragesSetAt = new Date();
    await venue.save();

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error setting venue blocked beverages:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Venue self-service
// ---------------------------------------------------------------------------

// The venue's own profile. Behind requireVenueAccount rather than
// requireVenueEligible so a venue awaiting approval can still sign in and be
// told so, instead of meeting a 403 with nothing to explain it.
const getMyVenue = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({ success: true, data: req.venue });
  } catch (error) {
    console.error("Error getting venue profile:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to load the venue profile",
    });
  }
};

// The catalogue this venue may pick from: active drinks minus its own blocks.
const listVenueSellableCatalog = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const beverages = await Beverage.find(sellableQuery(venue))
      .select("name image color")
      .sort("name")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: beverages,
      venueEligibility: venue.eligibility,
    });
  } catch (error) {
    console.error("Error listing venue sellable catalogue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// A venue's beverage line-up — reached by the owning venue and by admins
// ---------------------------------------------------------------------------

const listVenueBeverages = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const rows = await VenueBeverage.find({ venue: venue._id })
      .populate("beverage", "name image color isActive")
      .sort("createdAt")
      .lean();

    // A drink can be deactivated or blocked after it was added. The row stays,
    // but the venue needs to see that it will not sell, so each one carries why
    // it is currently unsellable rather than silently disappearing.
    const blocked = (venue.blockedBeverages || []).map(String);
    const now = new Date();
    const happyHours = await HappyHour.find({ venue: venue._id, cancelledAt: null }).lean();
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
      venue: {
        _id: venue._id,
        name: venue.name,
        venueType: venue.venueType,
        isActive: venue.isActive,
      },
      // Admins edit venues whose approval can be revoked independently; the UI
      // needs to say so rather than just failing on save.
      venueEligibility: venue.eligibility,
    });
  } catch (error) {
    console.error("Error listing venue beverages:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const addVenueBeverage = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    // The venue routes are already behind requireVenueEligible; this catches
    // the admin path, so an admin can never set up sales for a venue that was
    // never approved (or whose approval they just revoked).
    if (venue.eligibility !== "eligible") {
      throw new BadRequestError(
        "This venue is not approved to sell beverages. Grant approval first."
      );
    }

    const beverage = await findSellableBeverage(req.body.beverageId, venue);
    const price = parsePrice(req.body.price);
    const stockTotal = parseStock(req.body.stockTotal);

    const row = await VenueBeverage.create({
      venue: venue._id,
      beverage: beverage._id,
      price,
      stockTotal,
    });

    const populated = await VenueBeverage.findById(row._id).populate(
      "beverage",
      "name image color isActive"
    );

    res.status(StatusCodes.CREATED).json({ success: true, data: populated });
  } catch (error) {
    console.error("Error adding venue beverage:", error);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("That beverage is already on this venue's list")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateVenueBeverage = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    // Scoped to the venue from the context so an id belonging to another venue
    // cannot be edited through this route.
    const row = await VenueBeverage.findOne({ _id: req.params.id, venue: venue._id });
    if (!row) throw new NotFoundError("That beverage is not sold at this venue");

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

    const populated = await VenueBeverage.findById(row._id).populate(
      "beverage",
      "name image color isActive"
    );

    res.status(StatusCodes.OK).json({ success: true, data: populated });
  } catch (error) {
    console.error("Error updating venue beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Happy hour — a campaign: pick one or more drinks already sold at this
// venue, price each, publish. Mirrors the event channel's version in
// beverageController.js exactly; see there and utils/happyHour.js and
// models/HappyHour.js for the reasoning.
// ---------------------------------------------------------------------------

const notifyVenueBeverageRoom = (req, venueId, event, payload) => {
  try {
    const io = req.app.get("io");
    if (io) io.to(`venue_${venueId}_beverages`).emit(event, payload);
  } catch (error) {
    console.error(`Failed to emit ${event} to venue ${venueId}:`, error.message);
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

const assertNoOverlap = async (venueId, lineupIds, now = new Date()) => {
  const candidates = await HappyHour.find({
    venue: venueId,
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

const listVenueHappyHours = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const campaigns = await HappyHour.find({ venue: venue._id }).sort("-createdAt").lean();

    const lineupIds = [...new Set(campaigns.flatMap((c) => c.items.map((i) => String(i.lineup))))];
    const lineupById = new Map(
      (
        await VenueBeverage.find({ _id: { $in: lineupIds } })
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
    console.error("Error listing venue happy hours:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createVenueHappyHour = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (!rawItems.length) throw new BadRequestError("Pick at least one drink");

    const lineupIds = rawItems.map((i) => String(i.venueBeverageId || i.id || ""));
    if (lineupIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new BadRequestError("One or more drinks are invalid");
    }

    const rows = await VenueBeverage.find({ _id: { $in: lineupIds }, venue: venue._id });
    if (rows.length !== new Set(lineupIds).size) {
      throw new BadRequestError("One or more drinks are not sold at this venue");
    }
    const rowById = new Map(rows.map((r) => [String(r._id), r]));

    const items = rawItems.map((raw) => {
      const id = String(raw.venueBeverageId || raw.id);
      const row = rowById.get(id);
      const price = parsePrice(raw.price);
      if (price >= row.price) {
        throw new BadRequestError(
          `${price} isn't lower than ${row.price} for that drink's regular price`
        );
      }
      return { lineup: row._id, price };
    });

    await assertNoOverlap(venue._id, items.map((i) => i.lineup));

    const timing = parseHappyHourTiming(req.body);

    const campaign = await HappyHour.create({
      scope: "VENUE",
      venue: venue._id,
      items,
      ...timing,
      createdBy: req.user.userId,
    });

    if (timing.startMode === "scheduled") {
      notifyVenueBeverageRoom(req, venue._id, "happyHour:scheduled", {
        happyHourId: campaign._id,
        scheduledStartAt: timing.scheduledStartAt,
      });
    }

    res.status(StatusCodes.CREATED).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error creating venue happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const startVenueHappyHour = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const campaign = await HappyHour.findOne({ _id: req.params.id, venue: venue._id });
    if (!campaign) throw new NotFoundError("Happy hour not found");

    if (campaign.startMode !== "manual") {
      throw new BadRequestError("This happy hour starts automatically, not manually");
    }
    if (campaign.cancelledAt) throw new BadRequestError("This happy hour was cancelled");
    if (campaign.startedAt) throw new BadRequestError("This happy hour was already started");

    campaign.startedAt = new Date();
    await campaign.save();

    const state = getCampaignState(campaign);
    notifyVenueBeverageRoom(req, venue._id, "happyHour:started", {
      happyHourId: campaign._id,
      endsAt: state.endsAt,
      items: campaign.items,
    });

    res.status(StatusCodes.OK).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error starting venue happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const cancelVenueHappyHour = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);
    const campaign = await HappyHour.findOne({ _id: req.params.id, venue: venue._id });
    if (!campaign) throw new NotFoundError("Happy hour not found");
    if (campaign.cancelledAt) throw new BadRequestError("This happy hour was already cancelled");

    campaign.cancelledAt = new Date();
    await campaign.save();

    notifyVenueBeverageRoom(req, venue._id, "happyHour:cancelled", {
      happyHourId: campaign._id,
    });

    res.status(StatusCodes.OK).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Error cancelling venue happy hour:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const removeVenueBeverage = async (req, res) => {
  try {
    const venue = await resolveVenueContext(req);

    const existing = await VenueBeverage.findOne({
      _id: req.params.id,
      venue: venue._id,
    });
    if (!existing) throw new NotFoundError("That beverage is not sold at this venue");

    // Deleting a row that has sales behind it would orphan the ledger and lose
    // the record of what people paid for. Withdrawing it from sale is the
    // reversible action; deletion is only for a line that never sold.
    if (existing.sold > 0) {
      throw new BadRequestError(
        `${existing.sold} already sold, so this drink can't be removed. Use "Stop selling" instead.`
      );
    }

    await VenueBeverage.deleteOne({ _id: existing._id });

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Beverage removed from the venue",
    });
  } catch (error) {
    console.error("Error removing venue beverage:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Customer refill routes — browsing only, nothing here takes a payment yet.
// Any signed-in user; unlike events, a venue sale isn't gated behind holding
// a ticket to anything, so this is the same shape as the venue-account/admin
// versions above with the ownership check dropped rather than reused as-is.
// ---------------------------------------------------------------------------

const listRefillVenues = async (req, res) => {
  try {
    // `isActive`/`isAvailable` default to true, and a query filter does not
    // apply schema defaults to documents where the field was never set —
    // `{ $ne: false }` is what actually honours "true unless turned off".
    const venues = await Venue.find({ isActive: { $ne: false }, eligibility: "eligible" })
      .select("name venueType city image blockedBeverages")
      .lean();
    if (!venues.length) {
      return res.status(StatusCodes.OK).json({ success: true, data: [] });
    }

    const rows = await VenueBeverage.find({
      venue: { $in: venues.map((v) => v._id) },
      isAvailable: { $ne: false },
    })
      .select("venue beverage stockTotal sold")
      .populate("beverage", "isActive")
      .lean();

    const blockedByVenue = new Map(
      venues.map((v) => [String(v._id), (v.blockedBeverages || []).map(String)])
    );

    const countByVenue = new Map();
    for (const row of rows) {
      // No populated beverage means the catalogue row it pointed at was deleted.
      if (!row.beverage || row.beverage.isActive === false) continue;
      if ((row.stockTotal || 0) - (row.sold || 0) <= 0) continue;
      const venueKey = String(row.venue);
      if (blockedByVenue.get(venueKey)?.includes(String(row.beverage._id))) continue;
      countByVenue.set(venueKey, (countByVenue.get(venueKey) || 0) + 1);
    }

    const data = venues
      .filter((v) => countByVenue.has(String(v._id)))
      .map((v) => ({
        venueId: v._id,
        name: v.name,
        venueType: v.venueType,
        city: v.city,
        image: v.image,
        beverageCount: countByVenue.get(String(v._id)) || 0,
      }));

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error listing refill venues:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const getVenueRefillCatalog = async (req, res) => {
  try {
    const { venueId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(venueId)) {
      throw new NotFoundError("Venue not found");
    }

    const venue = await Venue.findById(venueId).select(
      "_id name venueType city isActive eligibility blockedBeverages"
    );
    if (!venue || !venue.isActive || venue.eligibility !== "eligible") {
      throw new NotFoundError("Venue not found");
    }

    const blocked = (venue.blockedBeverages || []).map(String);

    const rows = await VenueBeverage.find({ venue: venue._id, isAvailable: { $ne: false } })
      .populate("beverage", "name image color isActive")
      .lean();

    const now = new Date();
    const happyHours = await HappyHour.find({ venue: venue._id, cancelledAt: null }).lean();
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
      venue: { _id: venue._id, name: venue.name, venueType: venue.venueType, city: venue.city },
    });
  } catch (error) {
    console.error("Error listing venue refill catalog:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  resolveVenueContext,
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  setVenueEligibility,
  setVenueBlockedBeverages,
  getMyVenue,
  listVenueSellableCatalog,
  listVenueBeverages,
  addVenueBeverage,
  updateVenueBeverage,
  removeVenueBeverage,
  listVenueHappyHours,
  createVenueHappyHour,
  startVenueHappyHour,
  cancelVenueHappyHour,
  listRefillVenues,
  getVenueRefillCatalog,
};
