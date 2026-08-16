const express = require("express");
const router = express.Router();
const venueController = require("../controllers/venueController");
const venueSalesController = require("../controllers/venueSalesController");
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
// A venue's beverages, sales and money — reached by the owning venue and admins
// ---------------------------------------------------------------------------

// The catalogue this venue may pick from: active drinks minus its own blocks.
router.get(
  "/:venueId/catalog",
  authenticateUser,
  adminOrVenueAccount,
  venueController.listVenueSellableCatalog
);

router.get(
  "/:venueId/beverages",
  authenticateUser,
  adminOrVenueAccount,
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

// Recording a sale by hand. Restricted to admins and the owning venue — see the
// controller for why this is not open to customers.
router.post(
  "/:venueId/sales",
  authenticateUser,
  adminOrEligibleVenue,
  venueSalesController.createVenueSale
);
router.get(
  "/:venueId/sales",
  authenticateUser,
  adminOrVenueAccount,
  venueSalesController.listVenueSales
);
router.get(
  "/:venueId/dashboard",
  authenticateUser,
  adminOrVenueAccount,
  venueSalesController.getVenueDashboard
);
router.get(
  "/:venueId/finance",
  authenticateUser,
  adminOrVenueAccount,
  venueSalesController.getVenueFinance
);

module.exports = router;
