const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Beverage = require("../models/Beverage");
const OrganizerBeverageProfile = require("../models/OrganizerBeverageProfile");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");

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

const duplicateNameError = (error) =>
  error?.code === 11000 ? new BadRequestError("A beverage with this name already exists") : error;

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

// The catalogue an eligible organizer may pick from. Read-only: attaching a
// beverage to an event and pricing it is the next step's work.
const listActiveBeverages = async (req, res) => {
  try {
    // This is where the per-organizer selection is enforced. Empty means the
    // admin never blocked anything, so they get the whole active catalogue.
    const blocked = req.beverageProfile?.blockedBeverages || [];
    const query = { isActive: true };
    if (blocked.length > 0) query._id = { $nin: blocked };

    const beverages = await Beverage.find(query)
      .select("name image")
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
};
