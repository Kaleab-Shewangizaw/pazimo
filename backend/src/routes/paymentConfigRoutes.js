const express = require("express");
const router = express.Router();
const {
  getActiveProvider,
  updateActiveProvider,
} = require("../controllers/paymentConfigController");
const { authenticateUser, restrictTo } = require("../middlewares/auth");

// Public route to get active provider
router.get("/active", getActiveProvider);

// Admin only route to update provider
router.patch(
  "/active",
  authenticateUser,
  restrictTo("admin"),
  updateActiveProvider
);

module.exports = router;
