const express = require("express");
const router = express.Router();
const { authenticateUser, restrictTo } = require("../middlewares/auth");
const eventCashierController = require("../controllers/eventCashierController");

router.use(authenticateUser);

// Account management — admin OR the organizer running the event this
// cashier will end up scoped to (unlike usher's admin-only createUsher).
router.post(
  "/",
  restrictTo("admin", "organizer"),
  eventCashierController.createEventCashier
);
// List/deactivate — admin sees every event cashier; organizer sees (and may
// only touch) the ones it created itself (enforced inside the controller).
router.get(
  "/",
  restrictTo("admin", "organizer"),
  eventCashierController.listEventCashiers
);
router.patch(
  "/:cashierId",
  restrictTo("admin", "organizer"),
  eventCashierController.setEventCashierActive
);

// Cashier self-service — redeem an event's code, see what's currently unlocked.
router.post(
  "/unlock-event",
  restrictTo("cashier"),
  eventCashierController.redeemEventCode
);
router.get(
  "/my-events",
  restrictTo("cashier"),
  eventCashierController.getMyEvents
);

// Event-scoped cashier management. Ownership (organizer owns this event, or
// admin) is enforced inside the controller, not restrictTo, since "admin OR
// this specific event's organizer" isn't expressible as a role list.
router.post(
  "/events/:eventId/code",
  restrictTo("admin", "organizer"),
  eventCashierController.generateEventCode
);
router.get(
  "/events/:eventId/code",
  restrictTo("admin", "organizer"),
  eventCashierController.getEventCashierAccess
);
router.patch(
  "/events/:eventId/access/:cashierId/revoke",
  restrictTo("admin", "organizer"),
  eventCashierController.revokeCashierAccess
);

module.exports = router;
