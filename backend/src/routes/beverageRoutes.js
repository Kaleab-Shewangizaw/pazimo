const express = require("express");
const router = express.Router();
const beverageController = require("../controllers/beverageController");
const beverageSalesController = require("../controllers/beverageSalesController");
const beverageCheckoutController = require("../controllers/beverageCheckoutController");
const upload = require("../middlewares/upload");
const {
  getOrganizerBeverageFinance,
  getAdminBeverageFinance,
  listBeverageEvents,
} = require("../controllers/beverageFinanceController");
const {
  authenticateUser,
  protect,
  restrictTo,
  requireBeverageEligible,
} = require("../middlewares/auth");

// --- Admin ---------------------------------------------------------------
// Full admins only, matching how capitalRoutes.js gates its admin surface —
// 'partner' accounts are excluded from managing the catalogue and eligibility.

// Organizer eligibility. Declared before the /admin/:id catalogue routes so
// "organizers" is never captured as a beverage id.
router.get(
  "/admin/organizers",
  authenticateUser,
  restrictTo("admin"),
  beverageController.listOrganizersForBeverages
);
router.patch(
  "/admin/organizers/:id/eligibility",
  authenticateUser,
  restrictTo("admin"),
  beverageController.setEligibility
);
router.patch(
  "/admin/organizers/:id/beverages",
  authenticateUser,
  restrictTo("admin"),
  beverageController.setBlockedBeverages
);

// An event's beverage line-up, from the admin side. Same handlers as the
// organizer routes below — they resolve the event's owner and apply that
// organizer's permissions, so an admin editing an event cannot create a
// line-up the organizer would not be allowed to sell.
router.get(
  "/admin/events/:eventId/beverages",
  authenticateUser,
  restrictTo("admin"),
  beverageController.listEventBeverages
);
router.get(
  "/admin/events/:eventId/catalog",
  authenticateUser,
  restrictTo("admin"),
  beverageController.listEventSellableCatalog
);
router.post(
  "/admin/events/:eventId/beverages",
  authenticateUser,
  restrictTo("admin"),
  beverageController.addEventBeverage
);
router.patch(
  "/admin/events/:eventId/beverages/:id",
  authenticateUser,
  restrictTo("admin"),
  beverageController.updateEventBeverage
);
router.delete(
  "/admin/events/:eventId/beverages/:id",
  authenticateUser,
  restrictTo("admin"),
  beverageController.removeEventBeverage
);
// Happy hour campaigns — visible and manageable by admin the same way every
// other beverage surface is: same handlers the organizer routes call below,
// which resolve the event's real owner rather than trusting the caller.
router.get(
  "/admin/events/:eventId/happy-hours",
  authenticateUser,
  restrictTo("admin"),
  beverageController.listEventHappyHours
);
router.post(
  "/admin/events/:eventId/happy-hours",
  authenticateUser,
  restrictTo("admin"),
  beverageController.createEventHappyHour
);
router.post(
  "/admin/events/:eventId/happy-hours/:id/start",
  authenticateUser,
  restrictTo("admin"),
  beverageController.startEventHappyHour
);
router.delete(
  "/admin/events/:eventId/happy-hours/:id",
  authenticateUser,
  restrictTo("admin"),
  beverageController.cancelEventHappyHour
);

// --- Sales & dashboards ----------------------------------------------------
router.get(
  "/admin/dashboard",
  authenticateUser,
  restrictTo("admin"),
  beverageSalesController.getAdminDashboard
);
router.get(
  "/admin/sales",
  authenticateUser,
  restrictTo("admin"),
  beverageSalesController.listSales
);
router.patch(
  "/admin/sales/:id/refund",
  authenticateUser,
  restrictTo("admin"),
  beverageSalesController.refund
);
router.get(
  "/admin/events/:eventId/sales",
  authenticateUser,
  restrictTo("admin"),
  beverageSalesController.getEventSalesBreakdown
);

router.get(
  "/organizer/dashboard",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageSalesController.getOrganizerDashboard
);
router.get(
  "/organizer/sales",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageSalesController.listSales
);
router.get(
  "/organizer/events/:eventId/sales",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageSalesController.getEventSalesBreakdown
);

// Recording a sale by hand. Restricted to admins and the owning organizer —
// see the controller for why this is not open to customers yet.
router.post(
  "/sales",
  authenticateUser,
  restrictTo("admin", "organizer"),
  beverageSalesController.createSale
);

// Beverage catalogue
router.get(
  "/admin",
  authenticateUser,
  restrictTo("admin"),
  beverageController.listBeverages
);
router.post(
  "/admin",
  authenticateUser,
  restrictTo("admin"),
  upload.single("image"),
  beverageController.createBeverage
);
router.get(
  "/admin/:id",
  authenticateUser,
  restrictTo("admin"),
  beverageController.getBeverage
);
router.patch(
  "/admin/:id",
  authenticateUser,
  restrictTo("admin"),
  upload.single("image"),
  beverageController.updateBeverage
);
router.patch(
  "/admin/:id/status",
  authenticateUser,
  restrictTo("admin"),
  beverageController.setBeverageStatus
);
router.delete(
  "/admin/:id",
  authenticateUser,
  restrictTo("admin"),
  beverageController.deleteBeverage
);

// --- Organizer -------------------------------------------------------------
// Eligibility itself is always readable (that's how the organizer app decides
// whether to show the feature at all); the catalogue behind it is gated.
router.get(
  "/organizer/eligibility",
  authenticateUser,
  restrictTo("organizer"),
  beverageController.getMyEligibility
);
router.get(
  "/organizer/catalog",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.listActiveBeverages
);

// An event's beverage line-up. Every one of these re-checks that the event
// belongs to the caller, so eligibility alone never grants access to someone
// else's event.
router.get(
  "/organizer/events/:eventId/beverages",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.listEventBeverages
);
router.post(
  "/organizer/events/:eventId/beverages",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.addEventBeverage
);
router.patch(
  "/organizer/events/:eventId/beverages/:id",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.updateEventBeverage
);
router.delete(
  "/organizer/events/:eventId/beverages/:id",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.removeEventBeverage
);
// Happy hour campaigns for this event — pick one or more drinks already on
// the line-up above, price each, publish. One campaign covers as many drinks
// as the organizer picks; it is not per-drink.
router.get(
  "/organizer/events/:eventId/happy-hours",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.listEventHappyHours
);
router.post(
  "/organizer/events/:eventId/happy-hours",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.createEventHappyHour
);
router.post(
  "/organizer/events/:eventId/happy-hours/:id/start",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.startEventHappyHour
);
router.delete(
  "/organizer/events/:eventId/happy-hours/:id",
  authenticateUser,
  restrictTo("organizer"),
  requireBeverageEligible,
  beverageController.cancelEventHappyHour
);

// Beverage finance — its own dashboard, separate from ticket revenue.
//
// Organizers only. This endpoint reads the EVENT ledger (BeverageSale) and
// reports the organizer's "beverages" pool, so it can only ever answer for an
// account that sells drinks at events.
//
// It used to admit "cinema" as well, from when a cinema was going to be an
// organizer with a different catalogue. A cinema now has its own ledger
// (CinemaBeverageSale) and its own pool ("cinema_beverages"), so that access
// returned a flat zero off the wrong collection while the cinema's real takings
// sat elsewhere — the exact channel mixing this split exists to prevent.
// Cinema finance belongs on a cinema route backed by cinemaFinanceService.
router.get(
  "/finance/organizer",
  authenticateUser,
  restrictTo("organizer"),
  getOrganizerBeverageFinance
);
router.get(
  "/finance/organizer/:organizerId",
  authenticateUser,
  restrictTo("admin"),
  getOrganizerBeverageFinance
);
router.get(
  "/finance/events",
  authenticateUser,
  restrictTo("admin"),
  listBeverageEvents
);
router.get(
  "/finance/admin",
  authenticateUser,
  restrictTo("admin"),
  getAdminBeverageFinance
);

// --- Customer refill routes -----------------------------------------------
// Browsing only — no purchase/payment endpoint exists yet. Any signed-in
// customer; no role restriction, unlike every other route in this file.
router.get(
  "/refill/events",
  authenticateUser,
  beverageController.listRefillEvents
);
router.get(
  "/refill/events/:eventId/catalog",
  authenticateUser,
  beverageController.getEventRefillCatalog
);

// --- Customer refill checkout (Chapa only, gift cards optional) -----------
// Paying for the basket a customer just browsed above. Same auth as browsing
// — the controller re-verifies ticket ownership itself rather than trusting
// that a customer who could browse a minute ago still can now.
router.post(
  "/refill/events/:eventId/checkout/quote",
  authenticateUser,
  beverageCheckoutController.quoteEventRefillCheckout
);
router.post(
  "/refill/events/:eventId/checkout",
  authenticateUser,
  beverageCheckoutController.startEventRefillCheckout
);
router.get(
  "/refill/orders/:transactionId",
  authenticateUser,
  beverageCheckoutController.getEventRefillOrder
);

// --- Collecting a pre-bought drink at the door -----------------------------
// Same roles as ticket scanning (routes/ticketRoutes.js's validate-qr and
// check-in) since this is the same door staff, looking at the same ticket.
router.post(
  "/sales/:saleId/redeem",
  protect,
  restrictTo("admin", "organizer", "partner", "usher"),
  beverageSalesController.redeemBeverageSale
);

module.exports = router;
