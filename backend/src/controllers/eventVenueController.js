const fs = require("fs");
const path = require("path");
const { StatusCodes } = require("http-status-codes");
const EventVenue = require("../models/EventVenue");
const { BadRequestError, NotFoundError } = require("../errors");

// The event-venue directory's admin surface, plus the public browse/search
// endpoint the Discover screen's "Venues" tab reads. See models/EventVenue for
// why this is a separate, simpler collection from the Venue business account.

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Best-effort cleanup of a replaced/deleted local upload. Never throws: a
// leftover file is untidy, a failed request because of one is worse.
const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;

  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove event venue image:", error.message);
    }
  });
};

const duplicateNameError = (error) =>
  error?.code === 11000
    ? new BadRequestError("A venue with this name already exists in this city")
    : error;

// GET /public — anonymous, read-only, name/description search plus a city
// filter, mirroring cinemaController.listPublicCinemas.
const listPublicVenues = async (req, res) => {
  try {
    const { city, search } = req.query;
    const query = { isActive: true };
    if (city) query.city = new RegExp(`^${escapeRegex(city)}$`, "i");
    if (search) query.name = new RegExp(escapeRegex(search), "i");

    const venues = await EventVenue.find(query)
      .select("name description address city country image")
      .sort("name")
      .lean();

    res.status(StatusCodes.OK).json({ success: true, data: venues });
  } catch (error) {
    console.error("Error listing public event venues:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list venues",
      error: error.message,
    });
  }
};

// GET /admin — paginated, includes inactive rows.
const listVenues = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) query.name = new RegExp(escapeRegex(search), "i");
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const [venues, total, activeCount, inactiveCount] = await Promise.all([
      EventVenue.find(query).sort("name").skip(skip).limit(Number(limit)).lean(),
      EventVenue.countDocuments(query),
      EventVenue.countDocuments({ isActive: true }),
      EventVenue.countDocuments({ isActive: false }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: venues,
      stats: { active: activeCount, inactive: inactiveCount, total: activeCount + inactiveCount },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error("Error listing event venues:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list venues",
      error: error.message,
    });
  }
};

const getVenue = async (req, res) => {
  try {
    const venue = await EventVenue.findById(req.params.id);
    if (!venue) throw new NotFoundError("Venue not found");

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error getting event venue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createVenue = async (req, res) => {
  try {
    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Venue name is required");

    const venue = await EventVenue.create({
      name,
      description: normalizeText(req.body.description) ?? null,
      address: normalizeText(req.body.address) ?? null,
      city: normalizeText(req.body.city) ?? null,
      country: normalizeText(req.body.country) ?? null,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      isActive: parseBoolean(req.body.isActive, true),
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error creating event venue:", error);
    // The upload already landed on disk before validation ran — don't leave it
    // behind for a venue that was never created.
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateVenue = async (req, res) => {
  try {
    const venue = await EventVenue.findById(req.params.id);
    if (!venue) throw new NotFoundError("Venue not found");

    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("Venue name cannot be empty");
    }
    if (name) venue.name = name;

    if (req.body.description !== undefined) venue.description = normalizeText(req.body.description) ?? null;
    if (req.body.address !== undefined) venue.address = normalizeText(req.body.address) ?? null;
    if (req.body.city !== undefined) venue.city = normalizeText(req.body.city) ?? null;
    if (req.body.country !== undefined) venue.country = normalizeText(req.body.country) ?? null;

    venue.isActive = parseBoolean(req.body.isActive, venue.isActive);

    const previousImage = venue.image;
    if (req.file) venue.image = `/uploads/${req.file.filename}`;

    venue.updatedBy = req.user.userId;
    await venue.save();

    if (req.file && previousImage && previousImage !== venue.image) {
      removeUploadedImage(previousImage);
    }

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error updating event venue:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

// Dedicated activate/deactivate endpoint so the list can toggle a venue
// without resubmitting the whole (multipart) form.
const setVenueStatus = async (req, res) => {
  try {
    const isActive = parseBoolean(req.body.isActive, undefined);
    if (isActive === undefined) {
      throw new BadRequestError("isActive must be true or false");
    }

    const venue = await EventVenue.findById(req.params.id);
    if (!venue) throw new NotFoundError("Venue not found");

    venue.isActive = isActive;
    venue.updatedBy = req.user.userId;
    await venue.save();

    res.status(StatusCodes.OK).json({ success: true, data: venue });
  } catch (error) {
    console.error("Error updating event venue status:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const deleteVenue = async (req, res) => {
  try {
    const venue = await EventVenue.findByIdAndDelete(req.params.id);
    if (!venue) throw new NotFoundError("Venue not found");

    removeUploadedImage(venue.image);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Venue deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting event venue:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  listPublicVenues,
  listVenues,
  getVenue,
  createVenue,
  updateVenue,
  setVenueStatus,
  deleteVenue,
};
