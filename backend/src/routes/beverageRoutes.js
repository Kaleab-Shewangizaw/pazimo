const express = require("express");
const router = express.Router();
const beverageController = require("../controllers/beverageController");
const upload = require("../middlewares/upload");
const {
  authenticateUser,
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

module.exports = router;
