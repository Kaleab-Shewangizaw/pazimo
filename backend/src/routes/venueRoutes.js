const express = require("express");
const router = express.Router();
const venueController = require("../controllers/venueController");
const venueSalesController = require("../controllers/venueSalesController");
const venueCashierController = require("../controllers/venueCashierController");
const beverageCheckoutController = require("../controllers/beverageCheckoutController");
const upload = require("../middlewares/upload");
const {
  authenticateUser,
  restrictTo,
  requireVenueAccount,
  requireVenueEligible,
} = require("../middlewares/auth");

// The venue sales channel.
//
// Mounted at /api/venues. Deliberately its own router rather than more routes
// on beverageRoutes: that file's paths are all event-shaped
// (/organizer/events/:eventId/...), and hanging venue paths off it would put
// the two channels' authorization rules in one place where the wrong middleware
// is easy to reach for.
//
// Route order matters throughout: the literal /admin and /me segments are
// declared before /:venueId, or Express would capture "admin" as a venue id.

// ---------------------------------------------------------------------------
// Shared gates
// ---------------------------------------------------------------------------

// Routes an admin and the owning venue both reach. Admins pass straight
// through and are scoped by resolveVenueContext in the controller; a venue
// account has its own venue resolved from its account first, so the :venueId in
// the URL can only ever confirm what it already is — never redirect it at
// someone else's venue.
const adminOrVenueAccount = (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.user.role === "venue") return requireVenueAccount(req, res, next);
  return res.status(403).json({
    status: "error",
    message: "You do not have permission to perform this action",
  });
};

// The same, but the venue must also be approved to sell. Used on the routes
// that create money or stock; admins are trusted, and the controllers re-check
// the venue's approval on the admin path anyway.
const adminOrEligibleVenue = (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.user.role === "venue") return requireVenueEligible(req, res, next);
  return res.status(403).json({
    status: "error",
    message: "You do not have permission to perform this action",
  });
};

// Counter staff: admin, the owning venue, or one of its cashiers.
// requireVenueAccount resolves a cashier's venue from its own User doc (see
// middlewares/auth.js), so a cashier lands on req.venue exactly like the
// owner does. Used ONLY on the counter-operations + read-only-history routes
// below (catalog, beverages read, sales read, outstanding, redeem,
// dashboard) — profile, beverage/happy-hour management and finance stay on
// adminOrVenueAccount/adminOrEligibleVenue, which a cashier does not satisfy.
const adminOrVenueStaff = (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.user.role === "venue" || req.user.role === "cashier") {
    return requireVenueAccount(req, res, next);
  }
  return res.status(403).json({
    status: "error",
    message: "You do not have permission to perform this action",
  });
};

// The same, extended to cashiers, for the one counter route that also
// requires the venue to be approved to sell (creating a sale).
const adminOrEligibleVenueStaff = (req, res, next) => {
  if (req.user.role === "admin") return next();
  if (req.user.role === "venue" || req.user.role === "cashier") {
    return requireVenueEligible(req, res, next);
  }
  return res.status(403).json({
    status: "error",
    message: "You do not have permission to perform this action",
  });
};

// ---------------------------------------------------------------------------
// Admin — venue accounts and platform-wide venue reporting
// ---------------------------------------------------------------------------
// Full admins only, matching how beverageRoutes gates its admin surface —
// 'partner' accounts are excluded from managing venues and their money.

// Reporting first: these literal paths must not be captured by /admin/:id.
router.get(
  "/admin/dashboard",
  authenticateUser,
  restrictTo("admin"),
  venueSalesController.getAdminVenueDashboard
);
router.get(
  "/admin/finance",
  authenticateUser,
  restrictTo("admin"),
  venueSalesController.getAdminVenueFinance
);
router.get(
  "/admin/sales",
  authenticateUser,
  restrictTo("admin"),
  venueSalesController.listVenueSales
);
router.patch(
  "/admin/sales/:id/refund",
  authenticateUser,
  restrictTo("admin"),
  venueSalesController.refundVenueSale
);

router.get(
  "/admin",
  authenticateUser,
  restrictTo("admin"),
  venueController.listVenues
);
router.post(
  "/admin",
  authenticateUser,
  restrictTo("admin"),
  upload.single("image"),
  venueController.createVenue
);
router.get(
  "/admin/:id",
  authenticateUser,
  restrictTo("admin"),
  venueController.getVenue
);
router.patch(
  "/admin/:id",
  authenticateUser,
  restrictTo("admin"),
  upload.single("image"),
  venueController.updateVenue
);
router.patch(
  "/admin/:id/eligibility",
  authenticateUser,
  restrictTo("admin"),
  venueController.setVenueEligibility
);
// The venue's deny list, mirroring PATCH /api/beverages/admin/organizers/:id/beverages.
router.patch(
  "/admin/:id/beverages",
  authenticateUser,
  restrictTo("admin"),
  venueController.setVenueBlockedBeverages
);

// ---------------------------------------------------------------------------
// Venue self-service
// ---------------------------------------------------------------------------

// The venue's own profile, including its approval state. Behind
// requireVenueAccount rather than requireVenueEligible so a venue awaiting
// approval can sign in and be told so — this is how the app decides whether to
// show the selling surface at all.
router.get(
  "/me",
  authenticateUser,
  restrictTo("venue"),
  requireVenueAccount,
  venueController.getMyVenue
);

// ---------------------------------------------------------------------------
// Cashiers — reached by the owning venue and admins, never by a cashier
// itself. adminOrVenueAccount already admits only "admin"/"venue", excluding
// "cashier", so it doubles as the write gate here with no new middleware
// needed for that half.
// ---------------------------------------------------------------------------
router.get(
  "/:venueId/cashiers",
  authenticateUser,
  adminOrVenueAccount,
  venueCashierController.listCashiers
);
router.post(
  "/:venueId/cashiers",
  authenticateUser,
  adminOrVenueAccount,
  venueCashierController.createCashier
);
router.patch(
  "/:venueId/cashiers/:cashierId",
  authenticateUser,
  adminOrVenueAccount,
  venueCashierController.updateCashier
);
router.delete(
  "/:venueId/cashiers/:cashierId",
  authenticateUser,
  adminOrVenueAccount,
  venueCashierController.deleteCashier
);

// ---------------------------------------------------------------------------
// Customer refill routes — browsing only, no purchase/payment endpoint yet.
// Any signed-in user; unlike events, buying from a venue isn't gated behind
// holding a ticket to anything. Declared before /:venueId/... below, per this
// file's own route-order rule: a literal segment must come first or Express
// would try to match it as a :venueId.
// ---------------------------------------------------------------------------
router.get("/refill", authenticateUser, venueController.listRefillVenues);
router.get(
  "/:venueId/refill-catalog",
  authenticateUser,
  venueController.getVenueRefillCatalog
);

// --- Customer refill checkout (Chapa only, gift cards optional) -----------
// Paying for the basket a customer just browsed above. Same auth as
// browsing — the controller re-verifies venue eligibility itself.
router.post(
  "/:venueId/refill/checkout/quote",
  authenticateUser,
  beverageCheckoutController.quoteVenueRefillCheckout
);
router.post(
  "/:venueId/refill/checkout",
  authenticateUser,
  beverageCheckoutController.startVenueRefillCheckout
);
router.get(
  "/refill/orders/:transactionId",
  authenticateUser,
  beverageCheckoutController.getVenueRefillOrder
);

// ---------------------------------------------------------------------------
// A venue's beverages, sales and money — reached by the owning venue and admins
// ---------------------------------------------------------------------------

// The catalogue this venue may pick from: active drinks minus its own blocks.
router.get(
  "/:venueId/catalog",
  authenticateUser,
  adminOrVenueStaff,
  venueController.listVenueSellableCatalog
);

router.get(
  "/:venueId/beverages",
  authenticateUser,
  adminOrVenueStaff,
  venueController.listVenueBeverages
);
router.post(
  "/:venueId/beverages",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.addVenueBeverage
);
router.patch(
  "/:venueId/beverages/:id",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.updateVenueBeverage
);
router.delete(
  "/:venueId/beverages/:id",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.removeVenueBeverage
);
// Happy hour campaigns for this venue — pick one or more drinks already sold
// here, price each, publish. One campaign covers as many drinks as picked;
// it is not per-drink. adminOrVenueAccount for the read (browsing your own
// campaigns shouldn't be blocked by an eligibility lapse), adminOrEligibleVenue
// for anything that publishes/changes one — same split every other
// money-creating venue route already uses.
router.get(
  "/:venueId/happy-hours",
  authenticateUser,
  adminOrVenueAccount,
  venueController.listVenueHappyHours
);
router.post(
  "/:venueId/happy-hours",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.createVenueHappyHour
);
router.post(
  "/:venueId/happy-hours/:id/start",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.startVenueHappyHour
);
router.delete(
  "/:venueId/happy-hours/:id",
  authenticateUser,
  adminOrEligibleVenue,
  venueController.cancelVenueHappyHour
);

// Recording a sale by hand. Restricted to admins, the owning venue and its
// cashiers — see the controller for why this is not open to customers.
router.post(
  "/:venueId/sales",
  authenticateUser,
  adminOrEligibleVenueStaff,
  venueSalesController.createVenueSale
);
router.get(
  "/:venueId/sales",
  authenticateUser,
  adminOrVenueStaff,
  venueSalesController.listVenueSales
);
// Collecting a pre-bought drink at the counter. Same staff who can already
// see this venue's sales.
router.get(
  "/:venueId/sales/outstanding/:paymentReference",
  authenticateUser,
  adminOrVenueStaff,
  venueSalesController.getOutstandingVenueOrder
);
router.post(
  "/:venueId/sales/:id/redeem",
  authenticateUser,
  adminOrVenueStaff,
  venueSalesController.redeemVenueSale
);
router.get(
  "/:venueId/dashboard",
  authenticateUser,
  adminOrVenueStaff,
  venueSalesController.getVenueDashboard
);
router.get(
  "/:venueId/finance",
  authenticateUser,
  adminOrVenueAccount,
  venueSalesController.getVenueFinance
);

module.exports = router;
