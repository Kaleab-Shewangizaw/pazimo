const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const Cinema = require("../models/Cinema");
const CinemaHall = require("../models/CinemaHall");
const User = require("../models/User");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema } = require("../utils/cinemaAccess");
const {
  normalizeCommissionRate,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
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
      console.error("Failed to remove cinema image:", error.message);
    }
  });
};

// Turnaround minutes. null clears the hall's override so it inherits the
// cinema default; undefined means "not supplied" and leaves it untouched.
const parseTurnaround = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null" || value === "inherit") {
    return null;
  }
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new BadRequestError("turnaroundMinutes must be a whole number of 0 or more");
  }
  return minutes;
};

// The seat grid (Phase 2 scaffolding). Accepts a JSON object or a multipart
// string; the model validates it against capacity.
// Accepts either a real object or a JSON string, because the hall form is
// multipart (it can carry an image) and multipart has no types — everything
// arrives as text.
const asObject = (value, label) => {
  let raw = value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "null") return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      throw new BadRequestError(`${label} must be valid JSON`);
    }
  }
  return raw;
};

/** The seat categories a room offers. */
const parseSeatCategories = (value) => {
  if (value === undefined) return undefined;
  const raw = asObject(value, "seatCategories");
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new BadRequestError("seatCategories must be a list");

  return raw.map((category, index) => {
    const key = String(category?.key ?? "").trim().toLowerCase();
    const label = String(category?.label ?? "").trim();
    if (!key) throw new BadRequestError(`Seat category ${index + 1} needs a key`);
    if (!label) throw new BadRequestError(`Seat category "${key}" needs a label`);
    // The key is what tickets and showtime prices reference for ever, so it is
    // constrained to something that cannot break a URL or a lookup. The LABEL
    // is the free-text half a cinema renames as it likes.
    if (!/^[a-z0-9_-]+$/.test(key)) {
      throw new BadRequestError(
        `Seat category key "${key}" may only use letters, numbers, dashes and underscores`
      );
    }
    return {
      key,
      label,
      color: String(category?.color ?? "").trim() || "#6366f1",
    };
  });
};

/**
 * The room itself, row by row.
 *
 * Deliberately permissive about what a row or a seat is CALLED and strict about
 * structure: numbering conventions differ between cinemas and a wrong
 * assumption makes a real hall undescribable, but a malformed map would fail
 * later at sale time instead of here at edit time.
 *
 * Cross-row checks — duplicate labels, unknown categories, capacity — belong to
 * the model, so every write path gets them rather than only this one.
 */
const parseSeatMap = (value) => {
  if (value === undefined) return undefined;
  const raw = asObject(value, "seatMap");
  if (raw === null) return null;
  if (typeof raw !== "object") throw new BadRequestError("seatMap must be an object");

  const rows = raw.rows;
  if (!Array.isArray(rows)) throw new BadRequestError("seatMap.rows must be a list");
  if (rows.length === 0) return { rows: [] };
  if (rows.length > 60) {
    throw new BadRequestError("A hall can have at most 60 rows");
  }

  const asOffset = (v, label) => {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    if (!Number.isFinite(n) || n < -100 || n > 100) {
      throw new BadRequestError(`${label} must be a number between -100 and 100`);
    }
    return n;
  };

  return {
    rows: rows.map((row, rowIndex) => {
      const label = String(row?.label ?? "").trim();
      if (!label) throw new BadRequestError(`Row ${rowIndex + 1} needs a label`);

      const seats = Array.isArray(row?.seats) ? row.seats : [];
      if (seats.length > 80) {
        throw new BadRequestError(`Row ${label} has more than 80 seats`);
      }

      return {
        label,
        curve: asOffset(row?.curve, `Row ${label} curve`),
        offset: asOffset(row?.offset, `Row ${label} offset`),
        seats: seats.map((seat, seatIndex) => {
          const number = String(seat?.number ?? "").trim();
          if (!number) {
            throw new BadRequestError(
              `Seat ${seatIndex + 1} in row ${label} needs a number`
            );
          }
          return {
            number,
            categoryKey: String(seat?.categoryKey ?? "").trim().toLowerCase(),
            // Default TRUE: a seat sent without the flag is a seat, not a gap.
            exists: seat?.exists === undefined ? true : parseBoolean(seat.exists, true),
            blocked: parseBoolean(seat?.blocked, false),
          };
        }),
      };
    }),
  };
};

/**
 * Map a Mongoose validation failure onto a 400.
 *
 * Model-level rules (the seat-grid checks on CinemaHall) throw ValidationError,
 * which carries no statusCode — so the `error.statusCode || 500` fallback every
 * handler uses reported "internal server error" for what is plainly bad input,
 * and hid the message explaining what was wrong.
 */
const normalizeValidationError = (error) => {
  if (error?.name === "ValidationError") {
    const detail = Object.values(error.errors || {})
      .map((e) => e.message)
      .filter(Boolean)
      .join("; ");
    return new BadRequestError(detail || "Invalid input");
  }
  return error;
};

const duplicateNameError = (error) =>
  error?.code === 11000
    ? new BadRequestError("A cinema with this name already exists")
    : error;

/**
 * A commission rate from admin input.
 *
 * Validated against the band in config/rates rather than clamped silently: a
 * typo of 30 instead of 0.30 would take a third of a cinema's revenue, and an
 * admin who typed it needs to be told rather than have it quietly become 0.25.
 */
const parseRate = (value, label) => {
  if (value === undefined || value === null || value === "") return undefined;
  const rate = Number(value);
  if (!Number.isFinite(rate)) {
    throw new BadRequestError(`${label} must be a number`);
  }
  if (rate < MIN_COMMISSION_RATE || rate > MAX_COMMISSION_RATE) {
    throw new BadRequestError(
      `${label} must be between ${MIN_COMMISSION_RATE} and ${MAX_COMMISSION_RATE} (e.g. 0.03 for 3%)`
    );
  }
  return normalizeCommissionRate(rate);
};

// ---------------------------------------------------------------------------
// Admin — cinema management
// ---------------------------------------------------------------------------

const listCinemas = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.name = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const [cinemas, total, activeCount, inactiveCount] = await Promise.all([
      Cinema.find(query)
        .populate("account", "firstName lastName email phoneNumber isActive")
        .sort("name")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Cinema.countDocuments(query),
      Cinema.countDocuments({ isActive: true }),
      Cinema.countDocuments({ isActive: false }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: cinemas,
      stats: {
        active: activeCount,
        inactive: inactiveCount,
        total: activeCount + inactiveCount,
      },
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error listing cinemas:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list cinemas",
      error: error.message,
    });
  }
};

/**
 * Create a cinema and, with it, the account that logs into it.
 *
 * The two are created together on purpose. A cinema with no account cannot be
 * used, and an orphan "cinema" User with no cinema row would fail every
 * self-service route with a confusing "not linked to a cinema" — so the flow
 * that produces one always produces the other.
 *
 * Mirrors how venue accounts are provisioned: admin-created, never self-signup.
 * A business selling through Pazimo is onboarded by a human, and self-registration
 * would let anyone create a seller account that appears in the public listing.
 */
const createCinema = async (req, res) => {
  let createdUserId;
  try {
    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Cinema name is required");

    const email = normalizeText(req.body.email)?.toLowerCase();
    const phoneNumber = normalizeText(req.body.phoneNumber);
    const password = req.body.password;

    if (!email) throw new BadRequestError("Account email is required");
    if (!phoneNumber) throw new BadRequestError("Account phone number is required");
    if (!password || String(password).length < 6) {
      throw new BadRequestError("Account password must be at least 6 characters");
    }

    const existing = await User.findOne({ email });
    if (existing) {
      throw new BadRequestError("An account with this email already exists");
    }

    // The login. role "cinema" is what every restrictTo("cinema") route gates
    // on, and what keeps this account out of the organizer money routes.
    const account = await User.create({
      email,
      phoneNumber,
      password,
      role: "cinema",
      firstName: name,
      lastName: normalizeText(req.body.contactLastName) || "Cinema",
      isActive: true,
    });
    createdUserId = account._id;

    const cinema = await Cinema.create({
      account: account._id,
      name,
      description: normalizeText(req.body.description),
      city: normalizeText(req.body.city),
      address: normalizeText(req.body.address),
      phoneNumber,
      email,
      image: req.file ? `/uploads/${req.file.filename}` : null,
      isActive: parseBoolean(req.body.isActive, true),
      beverageEligibility:
        req.body.beverageEligibility === "eligible" ? "eligible" : "not_eligible",
      ticketCommissionRate: parseRate(
        req.body.ticketCommissionRate,
        "ticketCommissionRate"
      ),
      beverageCommissionRate: parseRate(
        req.body.beverageCommissionRate,
        "beverageCommissionRate"
      ),
      coversCinemaVat: parseBoolean(req.body.coversCinemaVat, false),
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { ...cinema.toObject(), account: { _id: account._id, email } },
    });
  } catch (error) {
    console.error("Error creating cinema:", error);
    // The account is created first, so a failure on the cinema row would leave
    // a "cinema" User that owns nothing and can log in to a broken dashboard.
    if (createdUserId) {
      await User.deleteOne({ _id: createdUserId }).catch((cleanupError) =>
        console.error(
          "Failed to roll back cinema account:",
          cleanupError.message
        )
      );
    }
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

/**
 * One cinema, with its halls.
 *
 * Serves both the admin detail page (id in the URL) and the cinema's own
 * profile screen (id ignored, resolved from the account) — see resolveCinema.
 */
const getCinema = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const [halls, populated] = await Promise.all([
      CinemaHall.find({ cinema: cinema._id }).sort("name").lean(),
      Cinema.findById(cinema._id)
        .populate("account", "firstName lastName email phoneNumber isActive")
        .lean(),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: { ...populated, halls },
    });
  } catch (error) {
    console.error("Error getting cinema:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Update a cinema.
 *
 * The commission rates, VAT coverage and eligibility are admin-only fields: a
 * cinema editing its own profile must not be able to set its own cut. They are
 * read from the body only when the caller is an admin, rather than being
 * validated and rejected, so a cinema sending them simply has them ignored.
 */
const updateCinema = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const isAdmin = req.user.role === "admin";
    const previousImage = cinema.image;

    const name = normalizeText(req.body.name);
    if (req.body.name !== undefined && !name) {
      throw new BadRequestError("Cinema name cannot be empty");
    }
    if (name) cinema.name = name;

    const assignIfPresent = (field, value) => {
      if (value !== undefined) cinema[field] = value;
    };

    assignIfPresent("description", normalizeText(req.body.description));
    assignIfPresent("city", normalizeText(req.body.city));
    assignIfPresent("address", normalizeText(req.body.address));
    assignIfPresent("phoneNumber", normalizeText(req.body.phoneNumber));
    assignIfPresent("email", normalizeText(req.body.email)?.toLowerCase());

    // An operational setting the cinema owns, unlike the commercial terms below
    // which stay admin-only: how long their own staff need to clean a hall is
    // not Pazimo's call.
    const turnaround = parseTurnaround(req.body.turnaroundMinutes);
    if (turnaround !== undefined && turnaround !== null) {
      cinema.turnaroundMinutes = turnaround;
    }

    if (req.file) cinema.image = `/uploads/${req.file.filename}`;

    if (isAdmin) {
      cinema.isActive = parseBoolean(req.body.isActive, cinema.isActive);
      cinema.coversCinemaVat = parseBoolean(
        req.body.coversCinemaVat,
        cinema.coversCinemaVat
      );

      const ticketRate = parseRate(
        req.body.ticketCommissionRate,
        "ticketCommissionRate"
      );
      if (ticketRate !== undefined) cinema.ticketCommissionRate = ticketRate;

      const beverageRate = parseRate(
        req.body.beverageCommissionRate,
        "beverageCommissionRate"
      );
      if (beverageRate !== undefined) {
        cinema.beverageCommissionRate = beverageRate;
      }

      if (req.body.beverageEligibility !== undefined) {
        const eligible = req.body.beverageEligibility === "eligible";
        cinema.beverageEligibility = eligible ? "eligible" : "not_eligible";
        cinema.eligibilitySetBy = req.user.userId;
        cinema.eligibilitySetAt = new Date();
        const notes = normalizeText(req.body.eligibilityNotes);
        if (notes !== undefined) cinema.eligibilityNotes = notes;
      }

      cinema.updatedBy = req.user.userId;
    }

    await cinema.save();

    // Only once the save succeeded — a failed update must not delete the image
    // the cinema is still using.
    if (req.file && previousImage) removeUploadedImage(previousImage);

    res.status(StatusCodes.OK).json({ success: true, data: cinema });
  } catch (error) {
    console.error("Error updating cinema:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized = duplicateNameError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

/**
 * Suspend or reinstate a cinema.
 *
 * Deactivating the cinema also deactivates its login, because a suspended
 * business that can still sign in and take money is not suspended. The two are
 * set together rather than the auth layer being taught to join through Cinema on
 * every request.
 */
const setCinemaStatus = async (req, res) => {
  try {
    const cinema = await Cinema.findById(req.params.cinemaId);
    if (!cinema) throw new NotFoundError("Cinema not found");

    const isActive = parseBoolean(req.body.isActive, undefined);
    if (isActive === undefined) {
      throw new BadRequestError("isActive is required");
    }

    cinema.isActive = isActive;
    cinema.updatedBy = req.user.userId;
    await cinema.save();

    await User.updateOne({ _id: cinema.account }, { isActive });

    res.status(StatusCodes.OK).json({ success: true, data: cinema });
  } catch (error) {
    console.error("Error setting cinema status:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Admin: grant or withdraw permission to sell concessions. */
const setBeverageEligibility = async (req, res) => {
  try {
    const cinema = await Cinema.findById(req.params.cinemaId);
    if (!cinema) throw new NotFoundError("Cinema not found");

    const { eligibility, notes } = req.body;
    if (!["eligible", "not_eligible"].includes(eligibility)) {
      throw new BadRequestError(
        "eligibility must be 'eligible' or 'not_eligible'"
      );
    }

    cinema.beverageEligibility = eligibility;
    cinema.eligibilitySetBy = req.user.userId;
    cinema.eligibilitySetAt = new Date();
    if (notes !== undefined) cinema.eligibilityNotes = normalizeText(notes);
    await cinema.save();

    res.status(StatusCodes.OK).json({ success: true, data: cinema });
  } catch (error) {
    console.error("Error setting cinema beverage eligibility:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Admin: narrow which catalogue products a cinema may sell. */
const setBlockedBeverages = async (req, res) => {
  try {
    const cinema = await Cinema.findById(req.params.cinemaId);
    if (!cinema) throw new NotFoundError("Cinema not found");

    const ids = Array.isArray(req.body.blockedBeverages)
      ? req.body.blockedBeverages
      : [];
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new BadRequestError("blockedBeverages must be beverage ids");
    }

    cinema.blockedBeverages = ids;
    cinema.blockedBeveragesSetBy = req.user.userId;
    cinema.blockedBeveragesSetAt = new Date();
    await cinema.save();

    res.status(StatusCodes.OK).json({ success: true, data: cinema });
  } catch (error) {
    console.error("Error setting cinema blocked beverages:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Halls
// ---------------------------------------------------------------------------

const listHalls = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const halls = await CinemaHall.find({ cinema: cinema._id })
      .sort("name")
      .lean();
    res.status(StatusCodes.OK).json({ success: true, data: halls });
  } catch (error) {
    console.error("Error listing halls:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createHall = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const name = normalizeText(req.body.name);
    if (!name) throw new BadRequestError("Hall name is required");

    const capacity = Number(req.body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new BadRequestError("capacity must be a whole number of at least 1");
    }

    const seatCategories = parseSeatCategories(req.body.seatCategories);
    const seatMap = parseSeatMap(req.body.seatMap);
    const turnaround = parseTurnaround(req.body.turnaroundMinutes);

    const hall = await CinemaHall.create({
      // Taken from the resolved cinema, never from the body — a hall cannot be
      // created inside someone else's cinema.
      cinema: cinema._id,
      name,
      capacity,
      screenType: normalizeText(req.body.screenType),
      // undefined leaves the schema default (null = inherit the cinema's).
      turnaroundMinutes: turnaround,
      hasAssignedSeating: parseBoolean(req.body.hasAssignedSeating, false),
      ...(seatCategories ? { seatCategories } : {}),
      ...(seatMap ? { seatMap } : {}),
      isActive: parseBoolean(req.body.isActive, true),
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: hall });
  } catch (error) {
    console.error("Error creating hall:", error);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("This cinema already has a hall with that name")
        : normalizeValidationError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateHall = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    // Scoped by cinema in the query itself: a hall id belonging to another
    // cinema simply does not match, so ownership cannot be forgotten.
    const hall = await CinemaHall.findOne({
      _id: req.params.hallId,
      cinema: cinema._id,
    });
    if (!hall) throw new NotFoundError("Hall not found");

    const name = normalizeText(req.body.name);
    if (name) hall.name = name;

    if (req.body.capacity !== undefined) {
      const capacity = Number(req.body.capacity);
      if (!Number.isInteger(capacity) || capacity < 1) {
        throw new BadRequestError(
          "capacity must be a whole number of at least 1"
        );
      }
      hall.capacity = capacity;
    }

    const screenType = normalizeText(req.body.screenType);
    if (screenType !== undefined) hall.screenType = screenType;

    const turnaround = parseTurnaround(req.body.turnaroundMinutes);
    if (turnaround !== undefined) hall.turnaroundMinutes = turnaround;

    const seatCategories = parseSeatCategories(req.body.seatCategories);
    if (seatCategories !== undefined) {
      hall.seatCategories = seatCategories || undefined;
    }

    const seatMap = parseSeatMap(req.body.seatMap);
    if (seatMap !== undefined) {
      hall.seatMap = seatMap || undefined;
      // Capacity is re-derived from the map by the model, so a stale capacity
      // sent alongside a new map never wins.
    }

    hall.hasAssignedSeating = parseBoolean(
      req.body.hasAssignedSeating,
      hall.hasAssignedSeating
    );
    hall.isActive = parseBoolean(req.body.isActive, hall.isActive);

    await hall.save();

    // Screenings already booked into this hall keep the tiers they were created
    // with. If the hall has just gained a seat map, those tiers price a NUMBER
    // OF SEATS rather than a seat CATEGORY, and every seat in the picker will
    // refuse to be added until they are re-saved.
    //
    // Surfaced here because this is the moment it becomes true and the moment
    // an operator can act on it — discovering it later, from a customer who
    // cannot buy a ticket, is the outcome worth spending a query to avoid.
    let warning;
    if (hall.hasAssignedSeating) {
      const CinemaShowtime = require("../models/CinemaShowtime");
      const stale = await CinemaShowtime.find({
        hall: hall._id,
        status: "scheduled",
        startsAt: { $gte: new Date() },
        // A tier with no seatCategoryKey is one that predates the map.
        ticketTypes: { $elemMatch: { seatCategoryKey: { $exists: false } } },
      })
        .select("startsAt movie")
        .populate("movie", "title")
        .sort({ startsAt: 1 })
        .limit(20)
        .lean();

      if (stale.length) {
        warning =
          `${stale.length} upcoming screening${stale.length === 1 ? "" : "s"} in ` +
          `${hall.name} still price by seat count rather than by seat category. ` +
          `Open each one and set a price per category, or customers will not be ` +
          `able to pick seats for them.`;
        console.warn(
          `[CINEMA-HALL] ${hall.name} (${hall._id}) gained a seat map with ${stale.length} ` +
            `showtime(s) still priced by allocation`
        );
      }
    }

    res.status(StatusCodes.OK).json({ success: true, data: hall, warning });
  } catch (error) {
    console.error("Error updating hall:", error);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("This cinema already has a hall with that name")
        : normalizeValidationError(error);
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const deleteHall = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const CinemaShowtime = require("../models/CinemaShowtime");

    const hall = await CinemaHall.findOne({
      _id: req.params.hallId,
      cinema: cinema._id,
    });
    if (!hall) throw new NotFoundError("Hall not found");

    // A hall with screenings behind it is deactivated rather than removed: the
    // showtimes and their tickets reference it and have to keep resolving.
    const scheduled = await CinemaShowtime.countDocuments({ hall: hall._id });
    if (scheduled > 0) {
      hall.isActive = false;
      await hall.save();
      return res.status(StatusCodes.OK).json({
        success: true,
        data: hall,
        message:
          "This hall has screenings against it, so it was deactivated rather than deleted.",
      });
    }

    await hall.deleteOne();
    res.status(StatusCodes.OK).json({ success: true, data: { _id: hall._id } });
  } catch (error) {
    console.error("Error deleting hall:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/** The cinemas a customer can browse. Only active ones, and never the account. */
const listPublicCinemas = async (req, res) => {
  try {
    const { city, search } = req.query;
    const query = { isActive: true };
    if (city) query.city = new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    if (search) {
      query.name = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }

    const cinemas = await Cinema.find(query)
      // An explicit projection rather than a populate-and-strip: the commission
      // rates, VAT coverage and the owning account must never reach a customer.
      .select("name description city address phoneNumber image")
      .sort("name")
      .lean();

    res.status(StatusCodes.OK).json({ success: true, data: cinemas });
  } catch (error) {
    console.error("Error listing public cinemas:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list cinemas",
    });
  }
};

module.exports = {
  listCinemas,
  createCinema,
  getCinema,
  updateCinema,
  setCinemaStatus,
  setBeverageEligibility,
  setBlockedBeverages,
  listHalls,
  createHall,
  updateHall,
  deleteHall,
  listPublicCinemas,
};
