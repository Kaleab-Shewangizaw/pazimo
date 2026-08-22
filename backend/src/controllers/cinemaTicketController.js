const { StatusCodes } = require("http-status-codes");
const CinemaTicket = require("../models/CinemaTicket");
const CinemaShowtime = require("../models/CinemaShowtime");
const cinemaTicketService = require("../services/cinemaTicketService");
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
 * What a cinema ticket's QR encodes.
 *
 * Deliberately a different shape from the event payload (which carries `tid`,
 * `nm`, `tp`, `tip`, `qty`). The extra `ctx: "CINEMA"` and the cinema id mean a
 * scanner can tell the two apart before it looks anything up, so an event
 * scanner pointed at a cinema ticket rejects it as the wrong kind rather than
 * searching the wrong collection and reporting "not found".
 *
 * Derived entirely from fields already on the ticket, so it is deterministic and
 * can be re-rendered on demand — nothing is persisted, the same decision
 * qrRenderer documents for event tickets.
 */
const buildCinemaQrPayload = (ticket) =>
  JSON.stringify({
    ctx: "CINEMA",
    tid: ticket.ticketId,
    cin: String(ticket.cinema),
    sh: String(ticket.showtime),
    tip: ticket.ticketType,
    qty: ticket.quantity,
  });

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

    const ticket = await cinemaTicketService.checkInTicket({
      ticketId: req.params.ticketId || req.body.ticketId,
      cinemaId: cinema._id,
      checkedInBy: req.user.userId,
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
      outstandingConcessions,
    });
  } catch (error) {
    console.error("Error checking in cinema ticket:", error);
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
      .select(
        "ticketId salesContext movieTitle hallName showtimeStartsAt ticketType price quantity totalAmount currency status paymentStatus checkedIn checkedAt customerName purchaseDate cinema movie hall"
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
      const png = await renderQrPng(payload);
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
  sellAtBoxOffice,
  listTickets,
  getTicketSummary,
  checkIn,
  refund,
  getPublicTicket,
  getTicketQr,
  listMyTickets,
};
