const express = require("express");
const router = express.Router();
const {
  getActiveProvider,
  updateActiveProvider,
  updateGiftCardMode,
  updateGiftCardRouting,
} = require("../controllers/paymentConfigController");
const { authenticateUser, restrictTo, optionalAuth } = require("../middlewares/auth");

// Public route to get the active provider + gift card mode flag. optionalAuth
// so an admin's own token (sent by the admin gift-card-routing screen) still
// gets the full config including the actual routing card numbers — see
// serializePublicConfig in the controller for why anonymous callers don't.
router.get("/active", optionalAuth, getActiveProvider);

// Admin only route to update provider
router.patch(
  "/active",
  authenticateUser,
  restrictTo("admin"),
  updateActiveProvider
);

// Admin only: toggle direct-merchant-pay vs gift-card routing
router.patch(
  "/giftcard-mode",
  authenticateUser,
  restrictTo("admin"),
  updateGiftCardMode
);

// Admin only: pick which gift card receives ETB / USD ticket payments
router.patch(
  "/giftcard-routing",
  authenticateUser,
  restrictTo("admin"),
  updateGiftCardRouting
);

module.exports = router;
