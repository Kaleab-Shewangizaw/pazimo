const express = require("express");
const router = express.Router();
const {
  getActiveProvider,
  updateActiveProvider,
  updateGiftCardMode,
  updateGiftCardRouting,
} = require("../controllers/paymentConfigController");
const { authenticateUser, restrictTo } = require("../middlewares/auth");

// Public route to get active provider + gift card routing config
router.get("/active", getActiveProvider);

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
