const express = require("express");
const router = express.Router();
const { authenticateUser, restrictTo } = require("../middlewares/auth");
const { registerLimiter } = require("../middlewares/rateLimiters");
const usherController = require("../controllers/usherController");

// Public — has to come before router.use(authenticateUser) below. Same
// limiter POST /api/auth/register uses; this is the same "public account
// creation" abuse shape.
router.post("/sign-up", registerLimiter, usherController.signUpUsher);

router.use(authenticateUser);

// Account management — admin only. Ushers can also self-register above now,
// but an admin can still hand out an account directly too.
router.post("/", restrictTo("admin"), usherController.createUsher);

// Usher self-service — redeem an event's code, see what's currently unlocked.
router.post(
  "/unlock-event",
  restrictTo("usher"),
  usherController.unlockEvent
);
router.get(
  "/my-events",
  restrictTo("usher"),
  usherController.getMyEvents
);

// Event-scoped usher management. Ownership (organizer owns this event, or
// admin) is enforced inside the controller, not restrictTo, since "admin OR
// this specific event's organizer" isn't expressible as a role list.
router.post(
  "/events/:eventId/code",
  restrictTo("admin", "organizer"),
  usherController.generateEventCode
);
router.get(
  "/events/:eventId/code",
  restrictTo("admin", "organizer"),
  usherController.getEventUsherAccess
);
router.patch(
  "/events/:eventId/access/:usherId/revoke",
  restrictTo("admin", "organizer"),
  usherController.revokeUsherAccess
);

module.exports = router;
