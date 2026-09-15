const express = require("express");

const router = express.Router();

const cinemaController = require("../controllers/cinemaController");
const programmeController = require("../controllers/cinemaProgrammeController");
const ticketController = require("../controllers/cinemaTicketController");
const checkoutController = require("../controllers/cinemaCheckoutController");
const beverageController = require("../controllers/cinemaBeverageController");
const concessionProductController = require("../controllers/concessionProductController");
const financeController = require("../controllers/cinemaFinanceController");
const upload = require("../middlewares/upload");
const {
  authenticateUser,
  optionalAuth,
  restrictTo,
  requireCinemaAccount,
} = require("../middlewares/auth");
const { rsvpPublicReadLimiter, cinemaCheckoutLimiter } = require("../middlewares/rateLimiters");

// The cinema channel's API.
//
// Three surfaces, and the split between them is the authorization model:
//
//   /admin/:cinemaId/*  — admin only, cinema named in the URL
//   /me/*               — cinema account only, cinema resolved from the ACCOUNT
//   /public/*           — anonymous, read-only, no money or ownership fields
//
// The handlers behind /admin and /me are the same functions. They resolve their
// target through resolveCinema (utils/cinemaAccess), which ignores the URL id
// for a cinema caller and reads it only for an admin — so a cinema cannot reach
// another cinema's data even if a route is later mis-wired, and an admin keeps
// full access without a second implementation.
//
// requireCinemaAccount re-reads the cinema (and its suspension) from the
// database on every /me request rather than trusting the JWT, so suspending a
// cinema takes effect immediately.

// A movie carries two images with different crops — a portrait poster for
// cards and a landscape cover for its own page — so the movie routes take two
// named files rather than one.
const movieUploads = upload.fields([
  { name: "poster", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);

const cinemaSelf = [
  authenticateUser,
  restrictTo("cinema"),
  requireCinemaAccount,
];
const adminOnly = [authenticateUser, restrictTo("admin")];

// ---------------------------------------------------------------------------
// Public — browsing and buying. Declared first so the static "public" segment is
// never captured as a cinema id by the routes below.
// ---------------------------------------------------------------------------

router.get("/public/cinemas", cinemaController.listPublicCinemas);
// The admin-curated promoted row. Declared before the /:cinemaId patterns so
// "featured-movies" is never read as a cinema id.
router.get("/public/featured-movies", programmeController.listFeaturedMovies);
router.get("/public/banner-movies", programmeController.listBannerMovies);
router.get("/public/trending-movies", programmeController.listTrendingMovies);
// One film's page: the movie, its cinema, and its screenings grouped by day.
// "movies" is a literal segment so it precedes the /:cinemaId patterns.
router.get("/public/movies/:movieId", programmeController.getPublicMovie);
router.get("/public/:cinemaId/movies", programmeController.listPublicMovies);
router.get("/public/:cinemaId/showtimes", programmeController.listPublicShowtimes);
router.get("/public/:cinemaId/concessions", beverageController.listPublicLineup);

// A ticket is readable by whoever holds its code — that is how a guest checkout
// works. optionalAuth so a signed-in customer is recognised without requiring it.
// --- Online checkout ------------------------------------------------------
//
// Rate-limited because these are unauthenticated and each one does real work:
// the quote prices a basket, and the checkout takes seat locks and calls a
// payment provider. Without a limit, a script could hold every seat in a
// sold-out screening by starting checkouts it never pays for.
router.get(
  "/public/showtimes/:showtimeId/seats",
  rsvpPublicReadLimiter,
  checkoutController.getShowtimeSeats
);
router.post(
  "/public/checkout/quote",
  rsvpPublicReadLimiter,
  optionalAuth,
  checkoutController.quoteCheckout
);
router.post(
  "/public/checkout",
  cinemaCheckoutLimiter,
  optionalAuth,
  checkoutController.startCheckout
);
// Give the seats back the moment a customer walks away, rather than making the
// next buyer wait out the ten-minute hold.
router.post(
  "/public/checkout/:transactionId/cancel",
  cinemaCheckoutLimiter,
  checkoutController.cancelCheckout
);
router.get("/public/orders/:transactionId", optionalAuth, checkoutController.getOrder);

router.get("/public/tickets/:ticketId", optionalAuth, ticketController.getPublicTicket);
router.get("/public/tickets/:ticketId/qr.svg", ticketController.getTicketQr);
router.get("/public/tickets/:ticketId/qr.png", (req, res) => {
  req.query.format = "png";
  return ticketController.getTicketQr(req, res);
});

// One QR per ORDER — every seat bought in one checkout shares this code,
// instead of each seat carrying its own.
router.get("/public/orders/:reference/qr.svg", ticketController.getOrderQr);
router.get("/public/orders/:reference/qr.png", (req, res) => {
  req.query.format = "png";
  return ticketController.getOrderQr(req, res);
});

// A signed-in customer's own cinema tickets. Any authenticated account may read
// its OWN rows; the controller scopes by req.user.userId and takes no id.
//
// Deliberately NOT under /me: in this file /me means "the cinema I am", and
// putting a customer's tickets there would make the same prefix mean two
// different subjects depending on who is asking.
router.get("/my-tickets", authenticateUser, ticketController.listMyTickets);

// Every cinema order this account has paid for — tickets and their snacks
// folded together the way a fresh checkout's receipt is, so the Tickets tab
// can show a movie order again after that one-time screen is gone.
router.get("/my-orders", authenticateUser, ticketController.listMyOrders);

// What this account can currently send to a friend — feeds the "send a
// ticket"/"send a snack" pickers in the chat/share UI (see
// routes/cinemaShareRoutes.js for the actual transfer). Same "not under /me"
// reasoning as /my-tickets above.
router.get(
  "/my-tickets/transferable",
  authenticateUser,
  ticketController.listTransferableTickets
);
router.get(
  "/my-concessions/transferable",
  authenticateUser,
  beverageController.listTransferableConcessions
);

// ---------------------------------------------------------------------------
// Cinema self-service
// ---------------------------------------------------------------------------

router.get("/me", ...cinemaSelf, cinemaController.getCinema);
router.patch("/me", ...cinemaSelf, upload.single("image"), cinemaController.updateCinema);
router.put("/me/security", ...cinemaSelf, cinemaController.updateCinemaPassword);

// Halls
router.get("/me/halls", ...cinemaSelf, cinemaController.listHalls);
router.post("/me/halls", ...cinemaSelf, cinemaController.createHall);
router.patch("/me/halls/:hallId", ...cinemaSelf, cinemaController.updateHall);
router.delete("/me/halls/:hallId", ...cinemaSelf, cinemaController.deleteHall);

// Movies
router.get("/me/movies", ...cinemaSelf, programmeController.listMovies);
// Literal segment, declared before the /me/movies/:movieId-shaped patterns
// below for the same reason "public/movies" precedes "public/:cinemaId"
// further up — Express would otherwise read "import-imdb" as a movie id.
router.post("/me/movies/import-imdb", ...cinemaSelf, programmeController.importFromImdb);
router.post("/me/movies", ...cinemaSelf, movieUploads, programmeController.createMovie);
router.patch("/me/movies/:movieId", ...cinemaSelf, movieUploads, programmeController.updateMovie);
router.delete("/me/movies/:movieId", ...cinemaSelf, programmeController.deleteMovie);

// Showtimes
router.get("/me/showtimes", ...cinemaSelf, programmeController.listShowtimes);
// The day-by-hall calendar view.
router.get("/me/schedule", ...cinemaSelf, programmeController.getSchedule);
router.post("/me/showtimes", ...cinemaSelf, programmeController.createShowtime);
router.patch("/me/showtimes/:showtimeId", ...cinemaSelf, programmeController.updateShowtime);
router.delete("/me/showtimes/:showtimeId", ...cinemaSelf, programmeController.deleteShowtime);

// Tickets
router.get("/me/ticket-sales", ...cinemaSelf, ticketController.listTickets);
router.get("/me/ticket-sales/summary", ...cinemaSelf, ticketController.getTicketSummary);
router.post("/me/ticket-sales", ...cinemaSelf, ticketController.sellAtBoxOffice);
// Admission. The cinema is resolved from the account, so a cinema can only ever
// validate its own screenings' tickets — and never an event ticket, which lives
// in a collection this route does not read.
//
// Read-only lookups first, so the scanner can show what it found and let staff
// confirm with a "Mark as used" tap rather than admitting the instant a camera
// decodes a frame.
router.get("/me/tickets/:ticketId", ...cinemaSelf, ticketController.getStaffTicket);
router.post("/me/check-in/:ticketId", ...cinemaSelf, ticketController.checkIn);
// The Seats tab's audit view: one screening's seat-by-seat status.
router.get(
  "/me/showtimes/:showtimeId/seats",
  ...cinemaSelf,
  ticketController.getShowtimeSeatsForStaff
);

// Concessions
router.get("/me/concessions/catalog", ...cinemaSelf, beverageController.listSellableCatalog);
router.get("/me/concessions", ...cinemaSelf, beverageController.listLineup);
router.post("/me/concessions", ...cinemaSelf, beverageController.addLineupItem);
router.patch("/me/concessions/:itemId", ...cinemaSelf, beverageController.updateLineupItem);
router.delete("/me/concessions/:itemId", ...cinemaSelf, beverageController.removeLineupItem);
router.get("/me/concession-sales", ...cinemaSelf, beverageController.listSales);
router.get("/me/concession-sales/summary", ...cinemaSelf, beverageController.getSalesSummary);
router.post("/me/concession-sales", ...cinemaSelf, beverageController.recordSale);
// Collection at the counter. A pre-bought item is a promise until someone hands
// it over, and without a record of that the same popcorn can be claimed twice.
router.get(
  "/me/orders/:reference/concessions",
  ...cinemaSelf,
  beverageController.listOutstandingForOrder
);
// The whole order, for the scanner to review before admitting it, and the
// single action that admits every eligible seat on it at once.
router.get("/me/orders/:reference", ...cinemaSelf, ticketController.getStaffOrder);
router.post(
  "/me/orders/:reference/check-in",
  ...cinemaSelf,
  ticketController.checkInOrder
);
router.post(
  "/me/concession-sales/:saleId/redeem",
  ...cinemaSelf,
  beverageController.redeemSale
);

// Money
router.get("/me/finance", ...cinemaSelf, financeController.getCinemaBalance);
router.get("/me/finance/withdrawals", ...cinemaSelf, financeController.listCinemaWithdrawals);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Everything with a literal second segment is declared before /admin/:cinemaId,
// so "finance", "ticket-sales" and "concession-sales" are never captured as a
// cinema id. Order is load-bearing here — do not move these below.
router.get("/admin/finance", ...adminOnly, financeController.getAdminCinemaFinance);

// Cross-cinema movie curation. Literal second segments, so declared before the
// /admin/:cinemaId patterns.
router.get("/admin/movies", ...adminOnly, programmeController.listAllMoviesForAdmin);
router.post("/admin/movies/import-imdb", ...adminOnly, programmeController.importFromImdb);
router.patch("/admin/movies/:movieId/display", ...adminOnly, programmeController.setMovieDisplay);
// The publication gate: a cinema creates a film, an admin decides whether it
// reaches customers. Same movie-id-only shape as /display, and for the same
// reason — an admin working the review queue works across cinemas.
router.patch("/admin/movies/:movieId/publication", ...adminOnly, programmeController.setMoviePublication);

// Reversals are admin-only on both ledgers: a refund moves money back out, so it
// is not something a cinema does to its own sales figures.
router.patch("/admin/ticket-sales/:ticketId/refund", ...adminOnly, ticketController.refund);
router.patch("/admin/concession-sales/:saleId/refund", ...adminOnly, beverageController.refundSale);

// The concession CATALOGUE — what a cinema counter can sell, and its artwork.
// Its own model (ConcessionProduct) and its own admin surface: it shares
// nothing with the event/venue beverages catalogue at /api/beverages. Literal
// second segment, so declared before /admin/:cinemaId.
router.get("/admin/products", ...adminOnly, concessionProductController.listProducts);
router.post(
  "/admin/products",
  ...adminOnly,
  upload.single("image"),
  concessionProductController.createProduct
);
router.get("/admin/products/:id", ...adminOnly, concessionProductController.getProduct);
router.patch(
  "/admin/products/:id",
  ...adminOnly,
  upload.single("image"),
  concessionProductController.updateProduct
);
router.patch(
  "/admin/products/:id/status",
  ...adminOnly,
  concessionProductController.setProductStatus
);
router.delete("/admin/products/:id", ...adminOnly, concessionProductController.deleteProduct);

router.get("/admin", ...adminOnly, cinemaController.listCinemas);
router.post("/admin", ...adminOnly, upload.single("image"), cinemaController.createCinema);

router.get("/admin/:cinemaId", ...adminOnly, cinemaController.getCinema);
router.patch("/admin/:cinemaId", ...adminOnly, upload.single("image"), cinemaController.updateCinema);
router.put("/admin/:cinemaId/security", ...adminOnly, cinemaController.updateCinemaPassword);
router.patch("/admin/:cinemaId/status", ...adminOnly, cinemaController.setCinemaStatus);
router.patch("/admin/:cinemaId/beverage-eligibility", ...adminOnly, cinemaController.setBeverageEligibility);
// Which catalogue products this cinema may sell. An ALLOW list: empty means
// nothing, so this is how a cinema gets a counter at all.
router.patch(
  "/admin/:cinemaId/allowed-concessions",
  ...adminOnly,
  cinemaController.setAllowedConcessions
);

// Halls
router.get("/admin/:cinemaId/halls", ...adminOnly, cinemaController.listHalls);
router.post("/admin/:cinemaId/halls", ...adminOnly, cinemaController.createHall);
router.patch("/admin/:cinemaId/halls/:hallId", ...adminOnly, cinemaController.updateHall);
router.delete("/admin/:cinemaId/halls/:hallId", ...adminOnly, cinemaController.deleteHall);

// Movies
router.get("/admin/:cinemaId/movies", ...adminOnly, programmeController.listMovies);
router.post("/admin/:cinemaId/movies", ...adminOnly, movieUploads, programmeController.createMovie);
router.patch("/admin/:cinemaId/movies/:movieId", ...adminOnly, movieUploads, programmeController.updateMovie);
router.delete("/admin/:cinemaId/movies/:movieId", ...adminOnly, programmeController.deleteMovie);

// Showtimes
router.get("/admin/:cinemaId/showtimes", ...adminOnly, programmeController.listShowtimes);
router.get("/admin/:cinemaId/schedule", ...adminOnly, programmeController.getSchedule);
router.get(
  "/admin/:cinemaId/showtimes/:showtimeId/seats",
  ...adminOnly,
  ticketController.getShowtimeSeatsForStaff
);
router.post("/admin/:cinemaId/showtimes", ...adminOnly, programmeController.createShowtime);
router.patch("/admin/:cinemaId/showtimes/:showtimeId", ...adminOnly, programmeController.updateShowtime);
router.delete("/admin/:cinemaId/showtimes/:showtimeId", ...adminOnly, programmeController.deleteShowtime);

// Sales
router.get("/admin/:cinemaId/ticket-sales", ...adminOnly, ticketController.listTickets);
router.get("/admin/:cinemaId/ticket-sales/summary", ...adminOnly, ticketController.getTicketSummary);
router.get("/admin/:cinemaId/concessions", ...adminOnly, beverageController.listLineup);
router.get("/admin/:cinemaId/concessions/catalog", ...adminOnly, beverageController.listSellableCatalog);
router.post("/admin/:cinemaId/concessions", ...adminOnly, beverageController.addLineupItem);
router.patch("/admin/:cinemaId/concessions/:itemId", ...adminOnly, beverageController.updateLineupItem);
router.delete("/admin/:cinemaId/concessions/:itemId", ...adminOnly, beverageController.removeLineupItem);
router.get("/admin/:cinemaId/concession-sales", ...adminOnly, beverageController.listSales);
router.get("/admin/:cinemaId/concession-sales/summary", ...adminOnly, beverageController.getSalesSummary);

// Money, per cinema
router.get("/admin/:cinemaId/finance", ...adminOnly, financeController.getCinemaBalance);
router.get("/admin/:cinemaId/finance/withdrawals", ...adminOnly, financeController.listCinemaWithdrawals);

module.exports = router;
