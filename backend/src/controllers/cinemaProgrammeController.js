const fs = require("fs");
const path = require("path");
const { StatusCodes } = require("http-status-codes");
const CinemaMovie = require("../models/CinemaMovie");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaHall = require("../models/CinemaHall");
const CinemaTicket = require("../models/CinemaTicket");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema } = require("../utils/cinemaAccess");

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

const removeUploadedImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== "string") return;
  const filename = path.basename(imagePath);
  if (!filename || filename === "." || filename === "..") return;
  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove movie poster:", error.message);
    }
  });
};

// Genres arrive as a JSON array from the dashboard and as a comma-separated
// string from a multipart form. Both are accepted rather than forcing one shape
// on the client.
const parseGenres = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map((g) => String(g).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((g) => String(g).trim()).filter(Boolean);
        }
      } catch {
        // Fall through to the comma-separated reading below.
      }
    }
    return trimmed.split(",").map((g) => g.trim()).filter(Boolean);
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Movies
// ---------------------------------------------------------------------------

const listMovies = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { status, search } = req.query;

    const query = { cinema: cinema._id };
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;
    if (search) {
      query.title = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }

    const movies = await CinemaMovie.find(query).sort("-createdAt").lean();

    // Screening counts make the listing useful on its own — a cinema wants to
    // see which films are actually scheduled without opening each one.
    const counts = await CinemaShowtime.aggregate([
      { $match: { cinema: cinema._id } },
      { $group: { _id: "$movie", showtimes: { $sum: 1 } } },
    ]);
    const byMovie = new Map(counts.map((c) => [String(c._id), c.showtimes]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: movies.map((m) => ({
        ...m,
        showtimeCount: byMovie.get(String(m._id)) || 0,
      })),
    });
  } catch (error) {
    console.error("Error listing movies:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createMovie = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const title = normalizeText(req.body.title);
    if (!title) throw new BadRequestError("Movie title is required");

    const duration = req.body.durationMinutes;
    let durationMinutes;
    if (duration !== undefined && duration !== null && duration !== "") {
      durationMinutes = Number(duration);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
        throw new BadRequestError(
          "durationMinutes must be a whole number of at least 1"
        );
      }
    }

    const movie = await CinemaMovie.create({
      // From the resolved cinema, never the body — a film cannot be added to
      // someone else's listing.
      cinema: cinema._id,
      title,
      description: normalizeText(req.body.description),
      poster: req.file ? `/uploads/${req.file.filename}` : null,
      durationMinutes,
      genre: parseGenres(req.body.genre) || [],
      language: normalizeText(req.body.language),
      subtitles: normalizeText(req.body.subtitles),
      ageRating: normalizeText(req.body.ageRating),
      isActive: parseBoolean(req.body.isActive, true),
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: movie });
  } catch (error) {
    console.error("Error creating movie:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("This cinema already lists a film with that title")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const updateMovie = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    // Scoped by cinema in the query: another cinema's film simply does not match.
    const movie = await CinemaMovie.findOne({
      _id: req.params.movieId,
      cinema: cinema._id,
    });
    if (!movie) throw new NotFoundError("Movie not found");

    const previousPoster = movie.poster;
    const durationChanged =
      req.body.durationMinutes !== undefined &&
      req.body.durationMinutes !== null &&
      req.body.durationMinutes !== "";

    const title = normalizeText(req.body.title);
    if (req.body.title !== undefined && !title) {
      throw new BadRequestError("Movie title cannot be empty");
    }
    if (title) movie.title = title;

    const assignIfPresent = (field, value) => {
      if (value !== undefined) movie[field] = value;
    };
    assignIfPresent("description", normalizeText(req.body.description));
    assignIfPresent("language", normalizeText(req.body.language));
    assignIfPresent("subtitles", normalizeText(req.body.subtitles));
    assignIfPresent("ageRating", normalizeText(req.body.ageRating));

    const genres = parseGenres(req.body.genre);
    if (genres !== undefined) movie.genre = genres;

    if (durationChanged) {
      const durationMinutes = Number(req.body.durationMinutes);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
        throw new BadRequestError(
          "durationMinutes must be a whole number of at least 1"
        );
      }
      movie.durationMinutes = durationMinutes;
    }

    if (req.file) movie.poster = `/uploads/${req.file.filename}`;
    movie.isActive = parseBoolean(req.body.isActive, movie.isActive);

    await movie.save();

    // A runtime change moves every future screening's end, and endsAt is what
    // overlap detection reads. Re-saving them re-runs the model hook that
    // derives it; done only for screenings still ahead, because rewriting the
    // end time of a showing that has already happened would be a lie.
    if (durationChanged) {
      const upcoming = await CinemaShowtime.find({
        movie: movie._id,
        startsAt: { $gte: new Date() },
      });
      await Promise.all(upcoming.map((s) => s.save()));
    }

    if (req.file && previousPoster) removeUploadedImage(previousPoster);

    res.status(StatusCodes.OK).json({ success: true, data: movie });
  } catch (error) {
    console.error("Error updating movie:", error);
    if (req.file) removeUploadedImage(`/uploads/${req.file.filename}`);
    const normalized =
      error?.code === 11000
        ? new BadRequestError("This cinema already lists a film with that title")
        : error;
    const status = normalized.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: normalized.message });
  }
};

const deleteMovie = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const movie = await CinemaMovie.findOne({
      _id: req.params.movieId,
      cinema: cinema._id,
    });
    if (!movie) throw new NotFoundError("Movie not found");

    // A film with screenings behind it is retired rather than removed: the
    // showtimes and their tickets reference it and have to keep resolving.
    const scheduled = await CinemaShowtime.countDocuments({ movie: movie._id });
    if (scheduled > 0) {
      movie.isActive = false;
      await movie.save();
      return res.status(StatusCodes.OK).json({
        success: true,
        data: movie,
        message:
          "This film has screenings against it, so it was retired rather than deleted.",
      });
    }

    await movie.deleteOne();
    if (movie.poster) removeUploadedImage(movie.poster);
    res.status(StatusCodes.OK).json({ success: true, data: { _id: movie._id } });
  } catch (error) {
    console.error("Error deleting movie:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Showtimes
// ---------------------------------------------------------------------------

/**
 * Ticket tiers from client input.
 *
 * Prices and allocations are the only things a client sets; `sold` is never
 * accepted from a request, because it is the seat counter the atomic claim
 * depends on and letting a client write it would let a cinema reset its own
 * sales figures.
 */
const parseTicketTypes = (value) => {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new BadRequestError("ticketTypes must be a JSON array");
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestError("At least one ticket type is required");
  }

  const seen = new Set();
  return raw.map((tier) => {
    const name = normalizeText(tier?.name);
    if (!name) throw new BadRequestError("Every ticket type needs a name");

    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new BadRequestError(`Duplicate ticket type "${name}"`);
    }
    seen.add(key);

    const price = Number(tier?.price);
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestError(`${name}: price must be 0 or more`);
    }

    const allocation = Number(tier?.allocation);
    if (!Number.isInteger(allocation) || allocation < 0) {
      throw new BadRequestError(`${name}: allocation must be a whole number`);
    }

    return {
      name,
      price,
      allocation,
      description: normalizeText(tier?.description),
      isAvailable: parseBoolean(tier?.isAvailable, true),
    };
  });
};

/**
 * Refuse a screening that would run while the same hall is already occupied.
 *
 * Only checked when both windows are known. A film with no runtime has a null
 * endsAt, which the model documents as "cannot tell" — this warns rather than
 * silently approving a clash it never actually checked.
 */
const assertHallFree = async ({ hallId, startsAt, endsAt, excludeId }) => {
  if (!endsAt) return { warning: "No runtime set for this film, so overlapping screenings in the same hall could not be checked." };

  const query = {
    hall: hallId,
    status: { $ne: "cancelled" },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const clash = await CinemaShowtime.findOne(query)
    .populate("movie", "title")
    .lean();

  if (clash) {
    throw new BadRequestError(
      `That hall is already showing ${clash.movie?.title || "another film"} at ${new Date(clash.startsAt).toISOString()}`
    );
  }
  return {};
};

const listShowtimes = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const { movieId, hallId, from, to, status } = req.query;

    const query = { cinema: cinema._id };
    if (movieId) query.movie = movieId;
    if (hallId) query.hall = hallId;
    if (status) query.status = status;
    if (from || to) {
      query.startsAt = {};
      if (from) query.startsAt.$gte = new Date(from);
      if (to) query.startsAt.$lte = new Date(to);
    }

    const showtimes = await CinemaShowtime.find(query)
      .populate("movie", "title poster durationMinutes ageRating")
      .populate("hall", "name capacity")
      .sort("startsAt")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: showtimes.map((s) => ({
        ...s,
        // Derived rather than stored: the tiers already carry allocation and
        // sold, and a third counter would be one more thing to keep in step.
        seatsAllocated: (s.ticketTypes || []).reduce(
          (sum, t) => sum + (t.allocation || 0),
          0
        ),
        seatsSold: (s.ticketTypes || []).reduce(
          (sum, t) => sum + (t.sold || 0),
          0
        ),
      })),
    });
  } catch (error) {
    console.error("Error listing showtimes:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const createShowtime = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    // Both the film and the hall are re-fetched scoped to this cinema, so a
    // caller cannot schedule another cinema's film into their own hall (or the
    // reverse) by passing a foreign id.
    const [movie, hall] = await Promise.all([
      CinemaMovie.findOne({ _id: req.body.movie, cinema: cinema._id }).lean(),
      CinemaHall.findOne({ _id: req.body.hall, cinema: cinema._id }).lean(),
    ]);
    if (!movie) throw new NotFoundError("Movie not found for this cinema");
    if (!hall) throw new NotFoundError("Hall not found for this cinema");
    if (!hall.isActive) {
      throw new BadRequestError("That hall is not currently in use");
    }

    const startsAt = new Date(req.body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestError("startsAt must be a valid date and time");
    }

    const ticketTypes = parseTicketTypes(req.body.ticketTypes);
    const allocated = ticketTypes.reduce((sum, t) => sum + t.allocation, 0);
    if (allocated > hall.capacity) {
      throw new BadRequestError(
        `Those tiers allocate ${allocated} seats but ${hall.name} holds ${hall.capacity}`
      );
    }

    const showtime = new CinemaShowtime({
      cinema: cinema._id,
      movie: movie._id,
      hall: hall._id,
      startsAt,
      ticketTypes,
      status: "scheduled",
      isPublished: parseBoolean(req.body.isPublished, true),
    });
    // Runs the hook that derives endsAt, which the overlap check below reads.
    await showtime.validate();

    const { warning } = await assertHallFree({
      hallId: hall._id,
      startsAt: showtime.startsAt,
      endsAt: showtime.endsAt,
    });

    await showtime.save();

    res
      .status(StatusCodes.CREATED)
      .json({ success: true, data: showtime, warning });
  } catch (error) {
    console.error("Error creating showtime:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Update a screening.
 *
 * Tiers are merged rather than replaced. An incoming tier is matched to the
 * existing one by _id (or by name, for a client that only knows what it sent),
 * and its `sold` counter is carried across untouched — replacing the array
 * wholesale would reset every seat counter to zero and let the screening be
 * sold twice over.
 *
 * An allocation cannot be cut below what has already been sold, and a tier with
 * sales cannot be dropped: both would leave issued tickets with no seat.
 */
const updateShowtime = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const showtime = await CinemaShowtime.findOne({
      _id: req.params.showtimeId,
      cinema: cinema._id,
    });
    if (!showtime) throw new NotFoundError("Showtime not found");

    if (req.body.hall !== undefined) {
      const hall = await CinemaHall.findOne({
        _id: req.body.hall,
        cinema: cinema._id,
      }).lean();
      if (!hall) throw new NotFoundError("Hall not found for this cinema");
      showtime.hall = hall._id;
    }

    if (req.body.startsAt !== undefined) {
      const startsAt = new Date(req.body.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestError("startsAt must be a valid date and time");
      }
      showtime.startsAt = startsAt;
    }

    if (req.body.ticketTypes !== undefined) {
      const incoming = parseTicketTypes(req.body.ticketTypes);
      const existing = showtime.ticketTypes;

      const matched = new Set();
      const merged = incoming.map((tier) => {
        const current =
          (tier._id && existing.id(tier._id)) ||
          existing.find(
            (e) => e.name.toLowerCase() === tier.name.toLowerCase()
          );

        if (!current) return { ...tier, sold: 0 };

        matched.add(String(current._id));
        if (tier.allocation < current.sold) {
          throw new BadRequestError(
            `${tier.name}: ${current.sold} seats are already sold, so the allocation cannot be set to ${tier.allocation}`
          );
        }
        return {
          _id: current._id,
          ...tier,
          // Carried across, never taken from the request.
          sold: current.sold,
        };
      });

      const droppedWithSales = existing.filter(
        (e) => !matched.has(String(e._id)) && e.sold > 0
      );
      if (droppedWithSales.length > 0) {
        throw new BadRequestError(
          `Cannot remove ${droppedWithSales.map((t) => t.name).join(", ")}: seats have already been sold`
        );
      }

      showtime.ticketTypes = merged;
    }

    if (req.body.status !== undefined) {
      if (!["scheduled", "cancelled", "completed"].includes(req.body.status)) {
        throw new BadRequestError("Unknown showtime status");
      }
      showtime.status = req.body.status;
    }
    showtime.isPublished = parseBoolean(
      req.body.isPublished,
      showtime.isPublished
    );

    await showtime.validate();

    const hall = await CinemaHall.findById(showtime.hall).lean();
    const allocated = showtime.ticketTypes.reduce(
      (sum, t) => sum + (t.allocation || 0),
      0
    );
    if (hall && allocated > hall.capacity) {
      throw new BadRequestError(
        `Those tiers allocate ${allocated} seats but ${hall.name} holds ${hall.capacity}`
      );
    }

    let warning;
    if (showtime.status !== "cancelled") {
      ({ warning } = await assertHallFree({
        hallId: showtime.hall,
        startsAt: showtime.startsAt,
        endsAt: showtime.endsAt,
        excludeId: showtime._id,
      }));
    }

    await showtime.save();
    res.status(StatusCodes.OK).json({ success: true, data: showtime, warning });
  } catch (error) {
    console.error("Error updating showtime:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

const deleteShowtime = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const showtime = await CinemaShowtime.findOne({
      _id: req.params.showtimeId,
      cinema: cinema._id,
    });
    if (!showtime) throw new NotFoundError("Showtime not found");

    // A screening with tickets against it is cancelled rather than removed. The
    // tickets are the ledger — deleting the row they point at would strand paid
    // sales and take the money with them.
    const sold = await CinemaTicket.countDocuments({
      showtime: showtime._id,
      status: { $nin: ["cancelled", "refunded"] },
    });
    if (sold > 0) {
      showtime.status = "cancelled";
      await showtime.save();
      return res.status(StatusCodes.OK).json({
        success: true,
        data: showtime,
        message: `${sold} ticket(s) have been sold, so this screening was cancelled rather than deleted. Refund them from the tickets tab.`,
      });
    }

    await showtime.deleteOne();
    res
      .status(StatusCodes.OK)
      .json({ success: true, data: { _id: showtime._id } });
  } catch (error) {
    console.error("Error deleting showtime:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Public — what is on
// ---------------------------------------------------------------------------

/**
 * A cinema's public schedule.
 *
 * Only published, scheduled, future screenings, and the projection deliberately
 * omits `sold` — seat counts are a business figure, and "3 left" is a nudge a
 * cinema should opt into rather than something the API leaks by default. The
 * remaining count is derived below instead, so a customer sees availability
 * without seeing the sales figures behind it.
 */
const listPublicShowtimes = async (req, res) => {
  try {
    const { cinemaId } = req.params;
    const { movieId, from, to } = req.query;

    const query = {
      cinema: cinemaId,
      status: "scheduled",
      isPublished: true,
      startsAt: { $gte: from ? new Date(from) : new Date() },
    };
    if (movieId) query.movie = movieId;
    if (to) query.startsAt.$lte = new Date(to);

    const showtimes = await CinemaShowtime.find(query)
      .populate("movie", "title poster durationMinutes ageRating genre language")
      .populate("hall", "name screenType")
      .sort("startsAt")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: showtimes.map((s) => ({
        _id: s._id,
        cinema: s.cinema,
        movie: s.movie,
        hall: s.hall,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        currency: s.currency,
        ticketTypes: (s.ticketTypes || [])
          .filter((t) => t.isAvailable)
          .map((t) => ({
            _id: t._id,
            name: t.name,
            price: t.price,
            description: t.description,
            seatsRemaining: Math.max((t.allocation || 0) - (t.sold || 0), 0),
          })),
      })),
    });
  } catch (error) {
    console.error("Error listing public showtimes:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list showtimes",
    });
  }
};

module.exports = {
  listMovies,
  createMovie,
  updateMovie,
  deleteMovie,
  listShowtimes,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  listPublicShowtimes,
};
