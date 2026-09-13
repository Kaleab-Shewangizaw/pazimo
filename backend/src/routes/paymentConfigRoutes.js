const express = require("express");
const router = express.Router();
const {
  getActiveProvider,
  updateActiveProvider,
  updateGiftCardMode,
  updateGiftCardRouting,
  updateCinemaGiftCardMode,
  updateCinemaGiftCardRouting,
  updateBeverageGiftCardMode,
  updateBeverageGiftCardRouting,
  updateVenueBeverageGiftCardMode,
  updateVenueBeverageGiftCardRouting,
} = require("../controllers/paymentConfigController");
const { authenticateUser, restrictTo, optionalAuth } = require("../middlewares/auth");

// Public route to get the active provider + gift card mode flags. optionalAuth
// so an admin's own token (sent by the admin gift-card-routing screens) still
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

// Admin only: toggle direct-merchant-pay vs gift-card routing, cinema channel
router.patch(
  "/cinema-giftcard-mode",
  authenticateUser,
  restrictTo("admin"),
  updateCinemaGiftCardMode
);

// Admin only: pick which gift card receives ETB / USD cinema payments
router.patch(
  "/cinema-giftcard-routing",
  authenticateUser,
  restrictTo("admin"),
  updateCinemaGiftCardRouting
);

// Admin only: toggle direct-merchant-pay vs gift-card routing, event-refill
// beverage channel
router.patch(
  "/beverage-giftcard-mode",
  authenticateUser,
  restrictTo("admin"),
  updateBeverageGiftCardMode
);

// Admin only: pick which gift card receives ETB / USD event-refill drink payments
router.patch(
  "/beverage-giftcard-routing",
  authenticateUser,
  restrictTo("admin"),
  updateBeverageGiftCardRouting
);

// Admin only: toggle direct-merchant-pay vs gift-card routing, venue channel
router.patch(
  "/venue-beverage-giftcard-mode",
  authenticateUser,
  restrictTo("admin"),
  updateVenueBeverageGiftCardMode
);

// Admin only: pick which gift card receives ETB / USD venue drink payments
router.patch(
  "/venue-beverage-giftcard-routing",
  authenticateUser,
  restrictTo("admin"),
  updateVenueBeverageGiftCardRouting
);

module.exports = router;
