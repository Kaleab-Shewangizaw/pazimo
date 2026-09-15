const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { StatusCodes } = require("http-status-codes");
const CinemaMovie = require("../models/CinemaMovie");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaHall = require("../models/CinemaHall");
const CinemaTicket = require("../models/CinemaTicket");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema } = require("../utils/cinemaAccess");
const { extractShortIdFromEventSlug } = require("../utils/eventUrl");
const { eatDateKey, eatDayBounds } = require("../services/platformFeeService");
const { fetchImdbMetadata } = require("../services/imdbService");

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

// multer.fields() delivers files on req.files keyed by field name, unlike
// .single() which sets req.file. One accessor so every call site reads the same
// way and a missing file is simply undefined.
const uploadedPath = (req, field) => {
  const file = req.files?.[field]?.[0];
  return file ? `/uploads/${file.filename}` : undefined;
};

// Every file this request wrote to disk, for cleanup when the write fails.
const uploadedPaths = (req) =>
  Object.values(req.files || {})
    .flat()
    .map((f) => `/uploads/${f.filename}`);

// The single definition of "a customer may see and buy this film".
//
// Every public read and every sale path is scoped by this rather than each
// spelling out its own filter, because a film that is buyable somewhere it is
// not visible — or visible somewhere it is not buyable — is exactly the drift a
// shared constant prevents. `isActive` is the cinema's own retire switch;
// `publicationStatus` is the admin's gate. A film needs both.
const PUBLIC_MOVIE_MATCH = { publicationStatus: "published", isActive: true };

const PUBLICATION_STATUSES = ["pending", "published", "rejected"];

const MOVIE_STATUSES = ["coming_soon", "now_showing", "archived"];
const parseStatus = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!MOVIE_STATUSES.includes(normalized)) {
    throw new BadRequestError(`status must be one of: ${MOVIE_STATUSES.join(", ")}`);
  }
  return normalized;
};

// Returns undefined for "not supplied" and null for "explicitly cleared", so an
// update can tell the two apart — same contract beverageController.parseColor
// uses.
const parseDate = (value, label) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${label} must be a valid date`);
  }
  return date;
};

// Genres and cast both arrive as a JSON array from the dashboard and as a
// comma-separated string from a multipart form. Both are accepted rather than
// forcing one shape on the client.
const parseStringList = (value) => {
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

// A lookup, not a write: it hands back what IMDb (via OMDb) has on the film
// so the dashboard form can prefill itself, and the organizer still submits
// through the normal create/update endpoint — reviewing and editing whatever
// came back — rather than this endpoint ever touching CinemaMovie itself.
const importFromImdb = async (req, res) => {
  try {
    const link = normalizeText(req.body.imdbUrl || req.body.url || req.body.imdbId);
    if (!link) throw new BadRequestError("Paste an IMDb link or id first");

    const data = await fetchImdbMetadata(link);
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error importing from IMDb:", error);
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
      poster: uploadedPath(req, "poster") ?? null,
      coverImage: uploadedPath(req, "coverImage") ?? null,
      durationMinutes,
      genre: parseStringList(req.body.genre) || [],
      cast: parseStringList(req.body.cast) || [],
      language: normalizeText(req.body.language),
      subtitles: normalizeText(req.body.subtitles),
      ageRating: normalizeText(req.body.ageRating),
      trailerUrl: normalizeText(req.body.trailerUrl),
      releaseDate: parseDate(req.body.releaseDate, "releaseDate") ?? undefined,
      status: parseStatus(req.body.status) ?? "now_showing",
      isActive: parseBoolean(req.body.isActive, true),
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: movie });
  } catch (error) {
    console.error("Error creating movie:", error);
    uploadedPaths(req).forEach(removeUploadedImage);
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
    const previousCover = movie.coverImage;
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
    assignIfPresent("trailerUrl", normalizeText(req.body.trailerUrl));

    const releaseDate = parseDate(req.body.releaseDate, "releaseDate");
    if (releaseDate !== undefined) movie.releaseDate = releaseDate;

    const status = parseStatus(req.body.status);
    if (status !== undefined) movie.status = status;

    const genres = parseStringList(req.body.genre);
    if (genres !== undefined) movie.genre = genres;

    const cast = parseStringList(req.body.cast);
    if (cast !== undefined) movie.cast = cast;

    if (durationChanged) {
      const durationMinutes = Number(req.body.durationMinutes);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
        throw new BadRequestError(
          "durationMinutes must be a whole number of at least 1"
        );
      }
      movie.durationMinutes = durationMinutes;
    }

    const newPoster = uploadedPath(req, "poster");
    const newCover = uploadedPath(req, "coverImage");
    if (newPoster) movie.poster = newPoster;
    if (newCover) movie.coverImage = newCover;
    movie.isActive = parseBoolean(req.body.isActive, movie.isActive);

    // Promotion is admin-only — see CinemaMovie.isFeatured. Read from the body
    // only when the caller is an admin, rather than validated and rejected, so a
    // cinema sending it simply has it ignored instead of failing its own edit.
    if (req.user.role === "admin") {
      const featured = parseBoolean(req.body.isFeatured, undefined);
      if (featured !== undefined && featured !== movie.isFeatured) {
        movie.isFeatured = featured;
        movie.featuredSetBy = req.user.userId;
        movie.featuredSetAt = new Date();
      }
      if (req.body.featuredOrder !== undefined) {
        const order = Number(req.body.featuredOrder);
        if (!Number.isFinite(order)) {
          throw new BadRequestError("featuredOrder must be a number");
        }
        movie.featuredOrder = order;
      }
    }

    // Bannering, unlike isFeatured/isTrending, is the one display slot a
    // cinema controls over its own catalogue — see CinemaMovie.bannerStatus.
    // Featured and trending stay admin-only because those rows are shared
    // shelf space across every cinema on the platform; a cinema's own banner
    // only ever shows on that cinema's own page, so there is no shared shelf
    // for a cinema bannering its own film to crowd.
    if (req.user.role === "cinema") {
      const banner = parseBoolean(req.body.bannerStatus, undefined);
      if (banner !== undefined) {
        if (banner && movie.publicationStatus !== "published") {
          throw new BadRequestError(
            "Publish this film before adding it to your banner"
          );
        }
        movie.bannerStatus = banner;
      }
    }

    // A published film goes back into the review queue when the CINEMA edits
    // what a customer sees (CinemaMovie.requeueOnCustomerFacingEdit) — that is
    // the whole point of the gate. It must not fire here when the editor is an
    // admin: the admin is the reviewing authority, so their own edit to a film
    // they already approved is not a rewrite that needs re-approving.
    if (req.user.role === "admin") {
      movie.$locals.skipRequeue = true;
    }

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

    // Only once the save succeeded — a failed update must not delete artwork
    // the film is still using.
    if (newPoster && previousPoster) removeUploadedImage(previousPoster);
    if (newCover && previousCover) removeUploadedImage(previousCover);

    res.status(StatusCodes.OK).json({ success: true, data: movie });
  } catch (error) {
    console.error("Error updating movie:", error);
    uploadedPaths(req).forEach(removeUploadedImage);
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
    if (movie.coverImage) removeUploadedImage(movie.coverImage);
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

    // On a hall with assigned seating the tier names a seat CATEGORY and the
    // model derives the allocation from the seat map, so an allocation is not
    // required here — and any figure sent alongside one is ignored rather than
    // trusted, because the map is the more specific statement.
    const seatCategoryKey = normalizeText(tier?.seatCategoryKey)?.toLowerCase();

    let allocation = 0;
    if (!seatCategoryKey) {
      allocation = Number(tier?.allocation);
      if (!Number.isInteger(allocation) || allocation < 0) {
        throw new BadRequestError(`${name}: allocation must be a whole number`);
      }
    }

    return {
      name,
      price,
      allocation,
      ...(seatCategoryKey ? { seatCategoryKey } : {}),
      description: normalizeText(tier?.description),
      isAvailable: parseBoolean(tier?.isAvailable, true),
    };
  });
};

/**
 * How long this hall needs between screenings, in minutes.
 *
 * The hall's own value wins when set; otherwise the cinema's default. Null on
 * the hall means "not set" and falls through — an explicit 0 is a real answer
 * ("this room needs no gap") and is preserved, which is why this tests for null
 * rather than falsiness.
 */
const turnaroundFor = (hall, cinema) => {
  if (hall && hall.turnaroundMinutes !== null && hall.turnaroundMinutes !== undefined) {
    return hall.turnaroundMinutes;
  }
  return cinema?.turnaroundMinutes ?? 0;
};

/**
 * Refuse a screening that would run while the same hall is still occupied.
 *
 * The occupied window is the screening PLUS its turnaround: a room showing a
 * film until 19:28 that needs 15 minutes to clean is not free at 19:30. Checking
 * only the film's own runtime produces schedules that do not overlap on paper
 * and cannot be run in practice, which is the failure this exists to prevent.
 *
 * The buffer is applied to both sides — the new screening's window is padded,
 * and so is each existing one — because a clash is symmetric: it does not matter
 * which of the two came first.
 *
 * Only checked when both windows are known. A film with no runtime has a null
 * endsAt, which the model documents as "cannot tell" — this warns rather than
 * silently approving a clash it never actually checked.
 */
const assertHallFree = async ({
  hallId,
  startsAt,
  endsAt,
  excludeId,
  turnaroundMinutes = 0,
}) => {
  if (!endsAt) {
    return {
      warning:
        "No runtime set for this film, so overlapping screenings in the same hall could not be checked.",
    };
  }

  const buffer = Math.max(Number(turnaroundMinutes) || 0, 0) * 60000;
  // The window this screening actually ties the room up for.
  const claimStart = new Date(startsAt.getTime() - buffer);
  const claimEnd = new Date(endsAt.getTime() + buffer);

  const query = {
    hall: hallId,
    status: { $ne: "cancelled" },
    startsAt: { $lt: claimEnd },
    endsAt: { $gt: claimStart },
  };
  if (excludeId) query._id = { $ne: excludeId };

  const clash = await CinemaShowtime.findOne(query)
    .populate("movie", "title")
    .sort({ startsAt: 1 })
    .lean();

  if (clash) {
    const when = new Date(clash.startsAt).toLocaleString();
    const until = clash.endsAt
      ? ` until ${new Date(clash.endsAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";
    const gap = buffer
      ? ` (allowing ${turnaroundMinutes} min to clean the hall)`
      : "";
    throw new BadRequestError(
      `That hall is showing ${clash.movie?.title || "another film"} at ${when}${until}${gap}. Pick another time or hall.`
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
    // Only meaningful on a hall that sells by capacity. On one with assigned
    // seating the model derives each tier's allocation from the seat map, so
    // summing what the client sent would compare a number nobody is going to
    // use against a capacity the map already guarantees.
    if (!hall.hasAssignedSeating) {
      const allocated = ticketTypes.reduce((sum, t) => sum + t.allocation, 0);
      if (allocated > hall.capacity) {
        throw new BadRequestError(
          `Those tiers allocate ${allocated} seats but ${hall.name} holds ${hall.capacity}`
        );
      }
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
      turnaroundMinutes: turnaroundFor(hall, cinema),
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
        // Only meaningful for a tier that carries its own allocation. A tier
        // that names a seat CATEGORY has allocation 0 here as a placeholder —
        // the model fills it from the seat map — so comparing it to `sold`
        // would refuse every re-price of an assigned-seating screening that had
        // sold a single ticket, which is exactly the screening most likely to
        // need re-pricing.
        if (!tier.seatCategoryKey && tier.allocation < current.sold) {
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
    // Runs after validate(), which is where an assigned-seating hall's
    // allocations are derived from the seat map — so on those halls this sum is
    // already the map's own totals and the comparison is trivially satisfied.
    // Skipped explicitly all the same, so the intent does not depend on hook
    // ordering staying the way it is today.
    if (hall && !hall.hasAssignedSeating) {
      const allocated = showtime.ticketTypes.reduce(
        (sum, t) => sum + (t.allocation || 0),
        0
      );
      if (allocated > hall.capacity) {
        throw new BadRequestError(
          `Those tiers allocate ${allocated} seats but ${hall.name} holds ${hall.capacity}`
        );
      }
    }

    let warning;
    if (showtime.status !== "cancelled") {
      ({ warning } = await assertHallFree({
        hallId: showtime.hall,
        startsAt: showtime.startsAt,
        endsAt: showtime.endsAt,
        excludeId: showtime._id,
        turnaroundMinutes: turnaroundFor(hall, cinema),
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
 * One film's public page: the movie, its cinema, and every upcoming screening
 * grouped by day.
 *
 * Grouped by day on the server because that grouping is what the picker
 * renders, and because "which day is this screening on" depends on the
 * timezone the grouping is done in — doing it here means one answer rather than
 * one per client.
 *
 * Seats remaining are exposed per tier, but `sold` and `allocation` are not: a
 * customer needs to know whether they can buy, not how the cinema is
 * performing. Same projection rule as listPublicShowtimes.
 */
const getPublicMovie = async (req, res) => {
  try {
    const { movieId } = req.params;

    // The parameter is either a pretty slug ("spider-man-a7f2") or a raw id.
    // The shortId is the last dash-separated chunk and is what actually
    // identifies the film — the slug in front of it is decoration, so a stale
    // or mistyped title still resolves as long as the code is intact. Same
    // contract as extractShortIdFromEventSlug on the event side.
    const shortId = extractShortIdFromEventSlug(movieId);
    // Scoped by PUBLIC_MOVIE_MATCH, so an unpublished film 404s here exactly as
    // a non-existent one does. Deliberately not a 403: the existence of a film
    // an admin has not approved is not public information, and a distinguishable
    // response would let anyone enumerate what cinemas have submitted.
    const lookup = shortId
      ? { shortId, ...PUBLIC_MOVIE_MATCH }
      : mongoose.Types.ObjectId.isValid(movieId)
        ? { _id: movieId, ...PUBLIC_MOVIE_MATCH }
        : null;

    if (!lookup) throw new NotFoundError("Movie not found");

    const movie = await CinemaMovie.findOne(lookup)
      .populate({
        path: "cinema",
        // A suspended cinema's film must not be bookable; the populate match
        // returns null and is rejected below.
        match: { isActive: true },
        select: "name description city address phoneNumber image",
      })
      .lean();

    if (!movie || !movie.cinema) throw new NotFoundError("Movie not found");

    const showtimes = await CinemaShowtime.find({
      movie: movie._id,
      status: "scheduled",
      isPublished: true,
      startsAt: { $gte: new Date() },
    })
      .populate("hall", "name screenType")
      .sort("startsAt")
      .lean();

    // Group into days, preserving the chronological order the sort produced.
    const days = [];
    const byKey = new Map();
    for (const show of showtimes) {
      const start = new Date(show.startsAt);
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      if (!byKey.has(key)) {
        const day = { date: key, showtimes: [] };
        byKey.set(key, day);
        days.push(day);
      }

      const tiers = (show.ticketTypes || [])
        .filter((t) => t.isAvailable)
        .map((t) => ({
          _id: t._id,
          name: t.name,
          price: t.price,
          description: t.description,
          seatsRemaining: Math.max((t.allocation || 0) - (t.sold || 0), 0),
        }));

      byKey.get(key).showtimes.push({
        _id: show._id,
        startsAt: show.startsAt,
        endsAt: show.endsAt,
        currency: show.currency,
        hall: show.hall,
        ticketTypes: tiers,
        // One flag so the picker can grey out a full screening without summing
        // tiers itself and possibly disagreeing with the server.
        soldOut: tiers.every((t) => t.seatsRemaining === 0),
      });
    }

    const prices = showtimes
      .flatMap((s) => (s.ticketTypes || []).filter((t) => t.isAvailable).map((t) => t.price))
      .filter((p) => typeof p === "number");

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        movie: {
          _id: movie._id,
          slug: movie.slug,
          shortId: movie.shortId,
          title: movie.title,
          description: movie.description,
          poster: movie.poster,
          coverImage: movie.coverImage,
          durationMinutes: movie.durationMinutes,
          genre: movie.genre,
          cast: movie.cast,
          language: movie.language,
          subtitles: movie.subtitles,
          ageRating: movie.ageRating,
          trailerUrl: movie.trailerUrl,
          releaseDate: movie.releaseDate,
          status: movie.status,
        },
        cinema: movie.cinema,
        days,
        fromPrice: prices.length ? Math.min(...prices) : null,
        upcomingCount: showtimes.length,
      },
    });
  } catch (error) {
    console.error("Error loading public movie:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

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

/**
 * Every movie on the platform, for the admin curation screen.
 *
 * Spans all cinemas — the one movie endpoint that is not scoped to a single
 * one — because the question this answers is "what has been posted, and what
 * should we put on the front page". Filterable by cinema, status and display
 * slot so an admin can go straight to "what is currently bannered".
 */
const listAllMoviesForAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 24, search, cinemaId, status, slot } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.title = new RegExp(
        String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }
    if (cinemaId && mongoose.Types.ObjectId.isValid(cinemaId)) {
      query.cinema = cinemaId;
    }
    if (status) query.status = status;
    // The review queue. `?publication=pending` is what the admin's Cinema page
    // opens on, so the backlog is the default view rather than something to go
    // looking for.
    if (PUBLICATION_STATUSES.includes(req.query.publication)) {
      query.publicationStatus = req.query.publication;
    }
    // Jump straight to what currently occupies a display slot.
    if (slot === "banner") query.bannerStatus = true;
    if (slot === "featured") query.isFeatured = true;
    if (slot === "trending") query.isTrending = true;

    const [movies, total, counts] = await Promise.all([
      CinemaMovie.find(query)
        .populate("cinema", "name city isActive")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CinemaMovie.countDocuments(query),
      // Slot occupancy, so the screen can say "4 bannered" without a second
      // request per slot.
      CinemaMovie.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            banner: { $sum: { $cond: ["$bannerStatus", 1, 0] } },
            featured: { $sum: { $cond: ["$isFeatured", 1, 0] } },
            trending: { $sum: { $cond: ["$isTrending", 1, 0] } },
            // The review backlog, in the same pass — the admin screen shows it
            // as a badge and should not pay a second round trip for it.
            pending: {
              $sum: { $cond: [{ $eq: ["$publicationStatus", "pending"] }, 1, 0] },
            },
            published: {
              $sum: { $cond: [{ $eq: ["$publicationStatus", "published"] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ["$publicationStatus", "rejected"] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    // Screening counts make the list actionable: bannering a film with nothing
    // scheduled puts a dead card on the front page.
    const showCounts = await CinemaShowtime.aggregate([
      {
        $match: {
          movie: { $in: movies.map((m) => m._id) },
          status: "scheduled",
          isPublished: true,
          startsAt: { $gte: new Date() },
        },
      },
      { $group: { _id: "$movie", upcoming: { $sum: 1 } } },
    ]);
    const byMovie = new Map(showCounts.map((c) => [String(c._id), c.upcoming]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: movies.map((m) => ({
        ...m,
        upcomingShowtimes: byMovie.get(String(m._id)) || 0,
      })),
      slots: counts[0]
        ? { banner: counts[0].banner, featured: counts[0].featured, trending: counts[0].trending }
        : { banner: 0, featured: 0, trending: 0 },
      publication: counts[0]
        ? {
            pending: counts[0].pending,
            published: counts[0].published,
            rejected: counts[0].rejected,
          }
        : { pending: 0, published: 0, rejected: 0 },
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error listing movies for admin:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list movies",
      error: error.message,
    });
  }
};

/**
 * Publish, reject, or return a film to the queue.
 *
 * ADMIN ONLY. This is the gate between a cinema creating a listing and that
 * listing reaching customers: only a published film appears on the home page,
 * in browse, on its own public page, or in an online checkout.
 *
 * Takes a movie id alone rather than a cinema id plus a movie id, for the same
 * reason setMovieDisplay does — an admin working a review queue is working
 * across cinemas and should not have to know who owns a title to approve it.
 *
 * Rejecting does NOT delete anything. The cinema keeps the row, keeps its
 * showtimes, and can edit and resubmit; the note is what tells them why. A
 * rejection that destroyed work would make admins reluctant to use it.
 */
const setMoviePublication = async (req, res) => {
  try {
    const { movieId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      throw new NotFoundError("Movie not found");
    }

    const next = normalizeText(req.body.publicationStatus);
    if (!PUBLICATION_STATUSES.includes(next)) {
      throw new BadRequestError(
        `publicationStatus must be one of: ${PUBLICATION_STATUSES.join(", ")}`
      );
    }

    const note = normalizeText(req.body.note);
    if (next === "rejected" && !note) {
      // A rejection with no reason is not actionable — the cinema learns only
      // that it failed, not what to change — so the reason is required rather
      // than optional at exactly the moment it matters.
      throw new BadRequestError("A rejection needs a note saying why");
    }

    const movie = await CinemaMovie.findById(movieId).populate(
      "cinema",
      "name isActive"
    );
    if (!movie) throw new NotFoundError("Movie not found");

    const previous = movie.publicationStatus;

    movie.publicationStatus = next;
    movie.publicationNote = note || undefined;
    if (next === "published") {
      movie.publishedBy = req.user.userId;
      movie.publishedAt = new Date();
    } else {
      // Cleared rather than kept: these record who put the film live, and it is
      // no longer live. Leaving them would make an unpublished film look
      // approved in every screen that reads them.
      movie.publishedBy = undefined;
      movie.publishedAt = undefined;
    }

    // A film pulled from public view must not keep occupying shared shelf
    // space. Left set, an unpublished film would hold a banner or featured slot
    // that the public row then filters out — a slot that looks taken on the
    // admin screen and shows nothing to customers.
    if (next !== "published") {
      movie.bannerStatus = false;
      movie.isFeatured = false;
      movie.isTrending = false;
    }

    await movie.save();

    console.log(
      `[CINEMA-PUBLICATION] ${movie.title} (${movie._id}) ${previous} -> ${next} ` +
        `by admin ${req.user.userId}${note ? `: ${note}` : ""}`
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        _id: movie._id,
        title: movie.title,
        cinema: movie.cinema,
        publicationStatus: movie.publicationStatus,
        publicationNote: movie.publicationNote ?? null,
        publishedAt: movie.publishedAt ?? null,
        bannerStatus: movie.bannerStatus,
        isFeatured: movie.isFeatured,
        isTrending: movie.isTrending,
      },
    });
  } catch (error) {
    console.error("Error setting movie publication:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Put a film into (or out of) a display slot.
 *
 * Admin-only, and takes the movie id alone rather than a cinema id plus a movie
 * id: an admin curating the front page is working across cinemas and should not
 * have to know which cinema owns a title to promote it.
 *
 * Each flag is applied only when present, so a request can toggle one slot
 * without disturbing the others.
 */
const setMovieDisplay = async (req, res) => {
  try {
    const { movieId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      throw new NotFoundError("Movie not found");
    }

    const movie = await CinemaMovie.findById(movieId);
    if (!movie) throw new NotFoundError("Movie not found");

    // The display slots are public shelf space, and the public rows filter on
    // publication — so promoting an unpublished film would silently do nothing
    // while the admin screen showed the slot as taken. Refused here with a
    // reason rather than accepted into that inconsistency.
    if (movie.publicationStatus !== "published") {
      throw new BadRequestError(
        "Publish this film before giving it a banner, featured or trending slot"
      );
    }

    const applied = [];
    const setFlag = (field, value) => {
      const parsed = parseBoolean(value, undefined);
      if (parsed === undefined) return;
      movie[field] = parsed;
      applied.push(field);
    };

    setFlag("bannerStatus", req.body.bannerStatus);
    setFlag("isTrending", req.body.isTrending);

    const featured = parseBoolean(req.body.isFeatured, undefined);
    if (featured !== undefined && featured !== movie.isFeatured) {
      movie.isFeatured = featured;
      movie.featuredSetBy = req.user.userId;
      movie.featuredSetAt = new Date();
      applied.push("isFeatured");
    }

    if (req.body.featuredOrder !== undefined) {
      const order = Number(req.body.featuredOrder);
      if (!Number.isFinite(order)) {
        throw new BadRequestError("featuredOrder must be a number");
      }
      movie.featuredOrder = order;
      applied.push("featuredOrder");
    }

    if (applied.length === 0) {
      throw new BadRequestError(
        "Nothing to change — send bannerStatus, isFeatured, isTrending or featuredOrder"
      );
    }

    await movie.save();

    res.status(StatusCodes.OK).json({ success: true, data: movie, applied });
  } catch (error) {
    console.error("Error setting movie display:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Projects a showtime into the compact row shape both schedule views render. */
const toScheduleRow = (show) => ({
  _id: show._id,
  movie: show.movie,
  startsAt: show.startsAt,
  endsAt: show.endsAt,
  status: show.status,
  isPublished: show.isPublished,
  seatsAllocated: (show.ticketTypes || []).reduce(
    (sum, t) => sum + (t.allocation || 0),
    0
  ),
  seatsSold: (show.ticketTypes || []).reduce((sum, t) => sum + (t.sold || 0), 0),
  // Already on the document this row is built from — no extra query. Carried
  // through so the Tickets page's per-tier sales chips can render straight off
  // the week grid's own fetch, with no second round trip per screening picked.
  ticketTypes: (show.ticketTypes || []).map((t) => ({
    _id: t._id,
    name: t.name,
    price: t.price,
    allocation: t.allocation,
    sold: t.sold,
  })),
});

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One day's schedule, grouped by hall — what the calendar view renders. Also
 * answers a `from`/`to` range in one query, for the week view: same grouping,
 * just bucketed by day as well as by hall.
 *
 * Grouped on the server rather than in the page because the grouping IS the
 * answer to the question being asked ("what is running in each room today"),
 * and because the free-gap calculation below needs the turnaround rules, which
 * live here. Two clients would otherwise have to reimplement them and could
 * disagree about whether a hall is bookable.
 *
 * Every active hall appears, including empty ones: "Hall 3 has nothing on" is
 * exactly what an operator scanning for a slot needs to see, and omitting it
 * would make an idle room invisible.
 */
const getSchedule = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const { from: fromParam, to: toParam, date: dayParam } = req.query;
    const isRange = !!(fromParam && toParam);

    let rangeStart;
    let rangeEnd;
    if (isRange) {
      // Addis Ababa calendar-day boundaries, not the server's own timezone —
      // the VPS runs in UTC while every cinema is in Ethiopia, and comparing
      // server-local midnight against Addis midnight silently shifted
      // screenings near the day boundary onto the wrong day. Same convention
      // as platformFeeService's eatDayBounds.
      if (!DATE_KEY_RE.test(fromParam) || !DATE_KEY_RE.test(toParam)) {
        throw new BadRequestError("from/to must be YYYY-MM-DD");
      }
      rangeStart = eatDayBounds(fromParam).start;
      rangeEnd = eatDayBounds(toParam).start;
      if (rangeEnd <= rangeStart) {
        throw new BadRequestError("to must be after from");
      }
      // Defense in depth — the UI only ever asks for a week.
      if (Math.round((rangeEnd - rangeStart) / 86400000) > 31) {
        throw new BadRequestError("Range cannot exceed 31 days");
      }
    } else {
      // Addis Ababa day boundaries from a YYYY-MM-DD, defaulting to today.
      if (dayParam !== undefined && !DATE_KEY_RE.test(dayParam)) {
        throw new BadRequestError("date must be YYYY-MM-DD");
      }
      ({ start: rangeStart, end: rangeEnd } = eatDayBounds(dayParam || eatDateKey()));
    }

    const [halls, showtimes] = await Promise.all([
      CinemaHall.find({ cinema: cinema._id }).sort("name").lean(),
      CinemaShowtime.find({
        cinema: cinema._id,
        startsAt: { $gte: rangeStart, $lt: rangeEnd },
      })
        .populate("movie", "title poster durationMinutes ageRating")
        .sort("startsAt")
        .lean(),
    ]);

    const hallMeta = halls.map((hall) => ({
      _id: hall._id,
      name: hall.name,
      capacity: hall.capacity,
      screenType: hall.screenType,
      isActive: hall.isActive,
      // Resolved here so the UI can say "15 min gap" without re-deriving
      // the inheritance rule.
      turnaroundMinutes: turnaroundFor(hall, cinema),
    }));

    if (!isRange) {
      const byHall = new Map(halls.map((h) => [String(h._id), []]));
      const orphaned = [];
      for (const show of showtimes) {
        const key = String(show.hall);
        const row = toScheduleRow(show);
        // A screening whose hall was deleted still has to be visible
        // somewhere, or it silently disappears from the schedule while still
        // selling.
        if (byHall.has(key)) byHall.get(key).push(row);
        else orphaned.push(row);
      }

      return res.status(StatusCodes.OK).json({
        success: true,
        data: {
          date: rangeStart.toISOString(),
          cinema: { _id: cinema._id, name: cinema.name },
          defaultTurnaroundMinutes: cinema.turnaroundMinutes ?? 0,
          halls: hallMeta.map((hall) => ({
            ...hall,
            showtimes: byHall.get(String(hall._id)) || [],
          })),
          orphanedShowtimes: orphaned,
        },
      });
    }

    // Range mode: bucket by day-key, then by hall within each day.
    const hallIds = new Set(halls.map((h) => String(h._id)));
    const byDay = new Map();
    for (const show of showtimes) {
      const dayKey = eatDateKey(new Date(show.startsAt));
      if (!byDay.has(dayKey)) byDay.set(dayKey, { halls: new Map(), orphaned: [] });
      const bucket = byDay.get(dayKey);
      const hallKey = String(show.hall);
      const row = toScheduleRow(show);
      if (hallIds.has(hallKey)) {
        if (!bucket.halls.has(hallKey)) bucket.halls.set(hallKey, []);
        bucket.halls.get(hallKey).push(row);
      } else {
        bucket.orphaned.push(row);
      }
    }

    const days = [];
    const dayCount = Math.round((rangeEnd - rangeStart) / 86400000);
    for (let i = 0; i < dayCount; i += 1) {
      const d = new Date(rangeStart.getTime() + i * 86400000);
      const dayKey = eatDateKey(d);
      const bucket = byDay.get(dayKey);
      const hallsForDay = {};
      for (const hallId of hallIds) {
        hallsForDay[hallId] = bucket?.halls.get(hallId) || [];
      }
      days.push({
        date: dayKey,
        halls: hallsForDay,
        orphanedShowtimes: bucket?.orphaned || [],
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        from: rangeStart.toISOString(),
        to: rangeEnd.toISOString(),
        cinema: { _id: cinema._id, name: cinema.name },
        defaultTurnaroundMinutes: cinema.turnaroundMinutes ?? 0,
        halls: hallMeta,
        days,
      },
    });
  } catch (error) {
    console.error("Error building cinema schedule:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * The admin-curated promoted row — the platform-wide home/cinemas page, or one
 * cinema's own banner/hottest row when mounted under `/public/:cinemaId/...`.
 *
 * Unscoped (no cinemaId), this spans every cinema — the one public cinema
 * reader that reads across the platform. Scoped, it is the same flags
 * (bannerStatus/isTrending) read back through one cinema's own films, so a
 * cinema's promoted row is exactly the subset of the platform-wide one that
 * belongs to it, never a second curation mechanism to keep in step.
 *
 * Inactive films and suspended cinemas are excluded at the database rather
 * than filtered in the page, so a cinema going dark cannot leave its poster on
 * the front page.
 */
const listMoviesInSlot = (slotField, defaultLimit) => async (req, res) => {
  try {
    const { cinemaId } = req.params;
    if (cinemaId && !mongoose.Types.ObjectId.isValid(cinemaId)) {
      throw new NotFoundError("Cinema not found");
    }

    const limit = Math.min(Number(req.query.limit) || defaultLimit, 30);

    const query = { [slotField]: true, ...PUBLIC_MOVIE_MATCH };
    if (cinemaId) query.cinema = cinemaId;

    const movies = await CinemaMovie.find(query)
      .populate({
        path: "cinema",
        // The match runs on the joined document; a film whose cinema is
        // suspended comes back with cinema: null and is dropped below.
        match: { isActive: true },
        select: "name city image",
      })
      .sort({ featuredOrder: 1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const visible = movies.filter((m) => m.cinema);

    // The soonest upcoming screening per film, so a card can say "Today 19:30"
    // rather than making the customer open it to find out if it is even on.
    const next = await CinemaShowtime.aggregate([
      {
        $match: {
          movie: { $in: visible.map((m) => m._id) },
          status: "scheduled",
          isPublished: true,
          startsAt: { $gte: new Date() },
        },
      },
      { $sort: { startsAt: 1 } },
      { $group: { _id: "$movie", startsAt: { $first: "$startsAt" }, count: { $sum: 1 } } },
    ]);
    const byMovie = new Map(next.map((n) => [String(n._id), n]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: visible.map((m) => ({
        _id: m._id,
        slug: m.slug,
        shortId: m.shortId,
        title: m.title,
        poster: m.poster,
        durationMinutes: m.durationMinutes,
        ageRating: m.ageRating,
        genre: m.genre,
        language: m.language,
        description: m.description,
        coverImage: m.coverImage,
        cinema: m.cinema,
        nextShowtime: byMovie.get(String(m._id))?.startsAt || null,
        upcomingCount: byMovie.get(String(m._id))?.count || 0,
      })),
    });
  } catch (error) {
    console.error(`Error listing ${slotField} movies:`, error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message: status === StatusCodes.INTERNAL_SERVER_ERROR ? "Failed to list movies" : error.message,
    });
  }
};

// The three public rows. Same reader, same projection, different slot — so a
// film cannot render differently depending on which strip it appears in.
const listFeaturedMovies = listMoviesInSlot("isFeatured", 12);
const listBannerMovies = listMoviesInSlot("bannerStatus", 8);
const listTrendingMovies = listMoviesInSlot("isTrending", 12);

/**
 * What is showing at one cinema.
 *
 * Only films that actually have an upcoming published screening are returned:
 * a customer browsing a cinema wants what they can buy, and a film with nothing
 * scheduled is a dead card. The counts and next time come from the same
 * aggregation so the list and its labels cannot disagree.
 */
const listPublicMovies = async (req, res) => {
  try {
    const { cinemaId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(cinemaId)) {
      throw new NotFoundError("Cinema not found");
    }

    const Cinema = require("../models/Cinema");
    const cinema = await Cinema.findOne({ _id: cinemaId, isActive: true })
      .select("name description city address phoneNumber image")
      .lean();
    if (!cinema) throw new NotFoundError("Cinema not found");

    const grouped = await CinemaShowtime.aggregate([
      {
        $match: {
          cinema: new mongoose.Types.ObjectId(String(cinemaId)),
          status: "scheduled",
          isPublished: true,
          startsAt: { $gte: new Date() },
        },
      },
      { $sort: { startsAt: 1 } },
      {
        $group: {
          _id: "$movie",
          nextShowtime: { $first: "$startsAt" },
          upcomingCount: { $sum: 1 },
          // The cheapest seat across upcoming screenings — a "from X" label.
          fromPrice: { $min: { $min: "$ticketTypes.price" } },
        },
      },
      { $sort: { nextShowtime: 1 } },
    ]);

    // The showtime aggregation above cannot filter on publication — that lives
    // on the film — so the gate is applied here, and the `byId.has(...)` filter
    // below drops any screening whose film is not published. A cinema can
    // therefore schedule freely while an admin review is outstanding without any
    // of it leaking to customers.
    const movies = await CinemaMovie.find({
      _id: { $in: grouped.map((g) => g._id) },
      ...PUBLIC_MOVIE_MATCH,
    })
      .select("title slug shortId poster durationMinutes ageRating genre language subtitles description")
      .lean();

    const byId = new Map(movies.map((m) => [String(m._id), m]));

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        cinema,
        movies: grouped
          .filter((g) => byId.has(String(g._id)))
          .map((g) => ({
            ...byId.get(String(g._id)),
            nextShowtime: g.nextShowtime,
            upcomingCount: g.upcomingCount,
            fromPrice: g.fromPrice ?? null,
          })),
      },
    });
  } catch (error) {
    console.error("Error listing public cinema movies:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  listMovies,
  importFromImdb,
  createMovie,
  updateMovie,
  deleteMovie,
  listShowtimes,
  createShowtime,
  updateShowtime,
  deleteShowtime,
  listPublicShowtimes,
  getPublicMovie,
  getSchedule,
  listAllMoviesForAdmin,
  setMovieDisplay,
  setMoviePublication,
  listFeaturedMovies,
  listBannerMovies,
  listTrendingMovies,
  listPublicMovies,
};
