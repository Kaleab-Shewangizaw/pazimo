const { StatusCodes } = require("http-status-codes");
const CinemaTicket = require("../models/CinemaTicket");
const CinemaShowtime = require("../models/CinemaShowtime");
const cinemaTicketService = require("../services/cinemaTicketService");
const cinemaSeatService = require("../services/cinemaSeatService");
const cinemaBeverageSalesService = require("../services/cinemaBeverageSalesService");
const { renderQrSvg, renderQrPng } = require("../utils/qrRenderer");
const { BadRequestError, NotFoundError } = require("../errors");
const { resolveCinema } = require("../utils/cinemaAccess");
const {
  getCinemaTicketRevenue,
  validCinemaTicketMatch,
} = require("../utils/cinemaTicketRevenueQuery");

// The cinema channel's ticket surface.
//
// Selling seats is what a cinema is for, so these routes are gated on the
// account owning the cinema and nothing else — unlike the concession routes,
// they carry no eligibility check.

/**
 * What a cinema ticket's QR encodes: just the bare ticketId — nothing else.
 * The scanner re-fetches everything (seat, type, quantity, status) from that
 * id, so there is no reason to carry any of it in the code itself.
 *
 * Changed 2026-09-07: this used to be JSON, `{ctx:"CINEMA", tid}`, so a
 * scanner could tell a cinema code from an event code and from a whole-ORDER
 * code before looking anything up. That `ctx` tag cost real, measured QR
 * density (a whole version bigger) for a nicer error message on the rare
 * wrong-scanner scan — cinema-scanner.tsx's extractCode() already falls back
 * to trying a bare code as a ticket id first and an order reference second
 * (see beginLookup/lookup there), so dropping the tag costs a slightly more
 * generic "not found" instead of "wrong kind of ticket," never a broken scan.
 *
 * Derived entirely from fields already on the ticket, so it is deterministic and
 * can be re-rendered on demand — nothing is persisted, the same decision
 * qrRenderer documents for event tickets.
 */
const buildCinemaQrPayload = (ticket) => String(ticket.ticketId);

/**
 * What a whole ORDER's QR encodes — every seat bought in one checkout shares
 * this single code, rather than each seat carrying its own. Bare, same as
 * the per-ticket payload above and for the same reason: the scanner's
 * ticket-then-order fallback already tells the two kinds apart at lookup
 * time without a `ctx` tag riding along in the printed pattern.
 */
const buildCinemaOrderQrPayload = (reference) => String(reference);

// ---------------------------------------------------------------------------
// Selling
// ---------------------------------------------------------------------------

/**
 * Sell at the counter.
 *
 * The price is never taken from the request — issueTicket resolves it from the
 * showtime server-side. The client says WHICH tier, never what it costs, the
 * same rule concessionBasketService enforces for baskets.
 */
const sellAtBoxOffice = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const ticket = await cinemaTicketService.issueTicket({
      showtimeId: req.body.showtime,
      ticketTypeId: req.body.ticketType,
      quantity: req.body.quantity ?? 1,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      customerEmail: req.body.customerEmail,
      channel: "box_office",
      // A counter sale is money already taken, so it is revenue immediately.
      paymentStatus: "completed",
      // Stops a caller selling seats for a cinema it does not own.
      cinemaId: cinema._id,
      // The counter opts out of the admin publication gate. Publication governs
      // Pazimo's public surface — the home page, browse, and the customer
      // checkout — not whether cinema staff may sell a seat to someone standing
      // at the till. Blocking here would let an admin review backlog close a
      // real box office, which is a worse outcome than an unlisted film selling
      // a counter ticket. Every other caller stays gated by default.
      requirePublished: false,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Error selling cinema ticket:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const listTickets = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const {
      page = 1,
      limit = 25,
      showtimeId,
      movieId,
      status,
      channel,
      from,
      to,
      search,
    } = req.query;
    const skip = (page - 1) * limit;

    const query = { cinema: cinema._id };
    if (showtimeId) query.showtime = showtimeId;
    if (movieId) query.movie = movieId;
    if (status) query.status = status;
    if (channel) query.channel = channel;
    if (from || to) {
      query.purchaseDate = {};
      if (from) query.purchaseDate.$gte = new Date(from);
      if (to) query.purchaseDate.$lte = new Date(to);
    }
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { ticketId: new RegExp(`^${safe}$`, "i") },
        { customerName: new RegExp(safe, "i") },
        { customerPhone: new RegExp(safe, "i") },
      ];
    }

    const [tickets, total] = await Promise.all([
      CinemaTicket.find(query)
        .populate("movie", "title poster")
        .populate("hall", "name")
        .sort("-purchaseDate")
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CinemaTicket.countDocuments(query),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error listing cinema tickets:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * The ticket dashboard: revenue plus what is selling.
 *
 * Revenue comes from getCinemaTicketRevenue rather than being summed here, so
 * this screen and the finance screen cannot disagree.
 */
const getTicketSummary = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const [revenue, byMovie, upcoming] = await Promise.all([
      getCinemaTicketRevenue(cinema._id, "ETB"),
      CinemaTicket.aggregate([
        { $match: { cinema: cinema._id, ...validCinemaTicketMatch("ETB") } },
        {
          $group: {
            _id: "$movie",
            title: { $first: "$movieTitle" },
            seatsSold: { $sum: "$quantity" },
            grossRevenue: { $sum: "$totalAmount" },
          },
        },
        { $sort: { grossRevenue: -1 } },
        { $limit: 20 },
      ]),
      CinemaShowtime.find({
        cinema: cinema._id,
        status: "scheduled",
        startsAt: { $gte: new Date() },
      })
        .populate("movie", "title poster")
        .populate("hall", "name")
        .sort("startsAt")
        .limit(10)
        .lean(),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        revenue,
        byMovie,
        upcoming: upcoming.map((s) => ({
          _id: s._id,
          movie: s.movie,
          hall: s.hall,
          startsAt: s.startsAt,
          seatsAllocated: (s.ticketTypes || []).reduce(
            (sum, t) => sum + (t.allocation || 0),
            0
          ),
          seatsSold: (s.ticketTypes || []).reduce(
            (sum, t) => sum + (t.sold || 0),
            0
          ),
        })),
      },
    });
  } catch (error) {
    console.error("Error building cinema ticket summary:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * One screening's seat-by-seat status for staff: available/held/sold/admitted
 * on an assigned-seating hall, or per-tier occupancy on a general-admission
 * one. This is the audit view behind the Tickets page's Seats tab — unlike
 * the public seat picker, it is scoped to the caller's own cinema (or, for an
 * admin, the cinema named in the URL) and shows who bought and who has
 * actually been admitted.
 */
const getShowtimeSeatsForStaff = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);
    const map = await cinemaSeatService.getStaffSeatMap(
      req.params.showtimeId,
      cinema._id
    );
    res.status(StatusCodes.OK).json({ success: true, data: map });
  } catch (error) {
    console.error("Error building staff seat map:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

/**
 * Admit the holder of a ticket.
 *
 * The cinema is resolved from the account and passed into the service, which
 * looks the ticket up scoped to it. A cinema therefore cannot validate another
 * cinema's ticket, and cannot validate an EVENT ticket at all — those live in a
 * different collection this route never reads.
 */
const checkIn = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    // Which seats to admit right now, for a ticket that names them — a group
    // of 4 on one ticket does not have to walk in together. Omitted (or every
    // request against an unassigned-hall ticket, which has none to name)
    // admits everything still outstanding, same as before this existed.
    const { ticket, admittedSeats, fullyAdmitted } =
      await cinemaTicketService.checkInTicket({
        ticketId: req.params.ticketId || req.body.ticketId,
        cinemaId: cinema._id,
        checkedInBy: req.user.userId,
        seatKeys: req.body.seatKeys,
      });

    // Anything pre-bought on the same order, returned with the admission.
    //
    // The door is where the customer physically is, and it is the one moment
    // staff have their order in front of them — asking them to look it up again
    // at the counter is how pre-bought popcorn quietly never gets collected.
    // Best effort: a failure here must not stop someone being let in.
    let outstandingConcessions = [];
    try {
      outstandingConcessions =
        await cinemaBeverageSalesService.listOutstandingForOrder({
          paymentReference: ticket.paymentReference,
          cinemaId: cinema._id,
        });
    } catch (error) {
      console.error(
        `[CINEMA] could not read pre-bought items for ${ticket.paymentReference}: ${error.message}`
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: ticket,
      admittedSeats,
      fullyAdmitted,
      outstandingConcessions,
    });
  } catch (error) {
    console.error("Error checking in cinema ticket:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Admit every eligible seat on one order in a single action — the "mark as
 * used" confirmation a staff member fires after reviewing the order in
 * getStaffOrder, not off a bare camera scan.
 */
const checkInOrder = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const { tickets, admittedCount } = await cinemaTicketService.checkInOrder({
      reference: req.params.reference,
      cinemaId: cinema._id,
      checkedInBy: req.user.userId,
      seatKeys: req.body.seatKeys,
    });

    let outstandingConcessions = [];
    try {
      outstandingConcessions =
        await cinemaBeverageSalesService.listOutstandingForOrder({
          paymentReference: req.params.reference,
          cinemaId: cinema._id,
        });
    } catch (error) {
      console.error(
        `[CINEMA] could not read pre-bought items for ${req.params.reference}: ${error.message}`
      );
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: { tickets, admittedCount },
      outstandingConcessions,
    });
  } catch (error) {
    console.error("Error checking in cinema order:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * A ticket, for the scanner to show BEFORE admitting it.
 *
 * Read-only and cinema-scoped, unlike getPublicTicket: this is what backs the
 * "review, then tap Mark as used" flow, so it never throws for an
 * already-used or refunded ticket — it returns the real status and lets the
 * frontend render that instead of an error.
 */
const getStaffTicket = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const ticket = await CinemaTicket.findOne({
      ticketId: req.params.ticketId,
      cinema: cinema._id,
    })
      .populate("movie", "title poster")
      .populate("hall", "name")
      .lean();
    if (!ticket) throw new NotFoundError("Ticket not found for this cinema");

    let outstandingConcessions = [];
    try {
      outstandingConcessions =
        await cinemaBeverageSalesService.listOutstandingForOrder({
          paymentReference: ticket.paymentReference,
          cinemaId: cinema._id,
        });
    } catch (error) {
      console.error(
        `[CINEMA] could not read pre-bought items for ${ticket.paymentReference}: ${error.message}`
      );
    }

    res.status(StatusCodes.OK).json({ success: true, data: ticket, outstandingConcessions });
  } catch (error) {
    console.error("Error reading cinema ticket for staff:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Every seat on one order, for the scanner to show BEFORE admitting it. */
const getStaffOrder = async (req, res) => {
  try {
    const cinema = await resolveCinema(req, req.params.cinemaId);

    const tickets = await CinemaTicket.find({
      paymentReference: req.params.reference,
      cinema: cinema._id,
    })
      .populate("movie", "title poster")
      .populate("hall", "name")
      .lean();
    if (!tickets.length) throw new NotFoundError("Order not found for this cinema");

    let outstandingConcessions = [];
    try {
      outstandingConcessions =
        await cinemaBeverageSalesService.listOutstandingForOrder({
          paymentReference: req.params.reference,
          cinemaId: cinema._id,
        });
    } catch (error) {
      console.error(
        `[CINEMA] could not read pre-bought items for ${req.params.reference}: ${error.message}`
      );
    }

    res.status(StatusCodes.OK).json({ success: true, data: tickets, outstandingConcessions });
  } catch (error) {
    console.error("Error reading cinema order for staff:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** Admin-only: reverse a ticket and return its seats. */
const refund = async (req, res) => {
  try {
    const ticket = await cinemaTicketService.refundTicket(req.params.ticketId, {
      adminId: req.user.userId,
      reason: req.body.reason,
    });
    res.status(StatusCodes.OK).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Error refunding cinema ticket:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// The ticket itself
// ---------------------------------------------------------------------------

/**
 * A single ticket, by its scannable code.
 *
 * Public: a customer holding the code can read their own ticket without an
 * account, which is how a guest checkout works. The projection is narrow for
 * that reason — it carries what a ticket has to show and nothing about the
 * cinema's money.
 */
const getPublicTicket = async (req, res) => {
  try {
    const ticket = await CinemaTicket.findOne({ ticketId: req.params.ticketId })
      .populate("cinema", "name address city image")
      .populate("movie", "title poster ageRating durationMinutes")
      .populate("hall", "name screenType")
      // `seats` included: on an assigned-seating hall it is the first thing
      // the customer looks for and what staff read at the door. Its absence
      // was why a ticket page could show the film and the time but not the
      // chairs.
      .select(
        "ticketId salesContext movieTitle hallName showtimeStartsAt ticketType price quantity totalAmount currency status paymentStatus checkedIn checkedAt customerName purchaseDate cinema movie hall seats"
      )
      .lean();

    if (!ticket) throw new NotFoundError("Ticket not found");

    res.status(StatusCodes.OK).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Error getting cinema ticket:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** The QR image, rendered on demand — never stored. */
const getTicketQr = async (req, res) => {
  try {
    const ticket = await CinemaTicket.findOne({
      ticketId: req.params.ticketId,
    }).lean();
    if (!ticket) throw new NotFoundError("Ticket not found");

    const payload = buildCinemaQrPayload(ticket);
    const wantsPng = req.params.ext === "png" || req.query.format === "png";

    if (wantsPng) {
      // Clamped: the width drives a bitmap allocation, so an unbounded value
      // from the query string is a trivial way to burn memory and CPU.
      const requested = parseInt(req.query.w, 10);
      const width = Number.isFinite(requested)
        ? Math.min(2048, Math.max(200, requested))
        : 400;

      const png = await renderQrPng(payload, width);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(png);
    }

    const svg = await renderQrSvg(payload);
    res.setHeader("Content-Type", "image/svg+xml");
    // The image is fully derived from the ticket and the ticket's identity never
    // changes, so it is safe to cache hard.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(svg);
  } catch (error) {
    console.error("Error rendering cinema ticket QR:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * The QR image for a whole ORDER — every seat sharing `reference` scans as
 * one code. Mirrors getTicketQr exactly; the only difference is the payload
 * and the lookup, which just needs proof the reference is real.
 */
const getOrderQr = async (req, res) => {
  try {
    const exists = await CinemaTicket.findOne({
      paymentReference: req.params.reference,
    })
      .select("_id")
      .lean();
    if (!exists) throw new NotFoundError("Order not found");

    const payload = buildCinemaOrderQrPayload(req.params.reference);
    const wantsPng = req.params.ext === "png" || req.query.format === "png";

    if (wantsPng) {
      const requested = parseInt(req.query.w, 10);
      const width = Number.isFinite(requested)
        ? Math.min(2048, Math.max(200, requested))
        : 400;

      const png = await renderQrPng(payload, width);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(png);
    }

    const svg = await renderQrSvg(payload);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(svg);
  } catch (error) {
    console.error("Error rendering cinema order QR:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** A signed-in customer's own cinema tickets. */
const listMyTickets = async (req, res) => {
  try {
    const tickets = await CinemaTicket.find({ customer: req.user.userId })
      .populate("cinema", "name city image")
      .populate("movie", "title poster")
      .sort("-purchaseDate")
      .lean();

    res.status(StatusCodes.OK).json({ success: true, data: tickets });
  } catch (error) {
    console.error("Error listing customer cinema tickets:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to list tickets",
    });
  }
};

module.exports = {
  buildCinemaQrPayload,
  buildCinemaOrderQrPayload,
  sellAtBoxOffice,
  listTickets,
  getTicketSummary,
  getShowtimeSeatsForStaff,
  checkIn,
  checkInOrder,
  getStaffTicket,
  getStaffOrder,
  refund,
  getPublicTicket,
  getTicketQr,
  getOrderQr,
  listMyTickets,
};
