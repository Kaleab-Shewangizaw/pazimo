const express = require("express");
const router = express.Router();
const capitalController = require("../controllers/capitalController");
const {
  authenticateUser,
  restrictTo,
  requireCapitalEligible,
} = require("../middlewares/auth");

// --- Admin ---------------------------------------------------------------
// Full admins only — matches how withdrawalRoutes.js restricts its own
// admin routes to 'admin', excluding 'partner' from every money-moving action.
router.get(
  "/admin/organizers",
  authenticateUser,
  restrictTo("admin"),
  capitalController.listOrganizersForCapital
);
router.get(
  "/admin/organizers/:id",
  authenticateUser,
  restrictTo("admin"),
  capitalController.getOrganizerCapitalDetail
);
router.patch(
  "/admin/organizers/:id/eligibility",
  authenticateUser,
  restrictTo("admin"),
  capitalController.setEligibility
);

router.get(
  "/admin/loans",
  authenticateUser,
  restrictTo("admin"),
  capitalController.listLoans
);
router.get(
  "/admin/loans/:id",
  authenticateUser,
  restrictTo("admin"),
  capitalController.getLoan
);
router.patch(
  "/admin/loans/:id/approve",
  authenticateUser,
  restrictTo("admin"),
  capitalController.approveLoan
);
router.patch(
  "/admin/loans/:id/reject",
  authenticateUser,
  restrictTo("admin"),
  capitalController.rejectLoan
);
router.patch(
  "/admin/loans/:id/cancel",
  authenticateUser,
  restrictTo("admin"),
  capitalController.adminCancelLoan
);

// --- Organizer -------------------------------------------------------------
// Loan history/detail/cancel stay reachable even if eligibility is later
// revoked — revocation only blocks *new* requests, it must not erase an
// organizer's visibility into a loan they already took out.
router.get(
  "/organizer/eligibility",
  authenticateUser,
  restrictTo("organizer"),
  capitalController.getMyEligibility
);
router.get(
  "/organizer/summary",
  authenticateUser,
  restrictTo("organizer"),
  requireCapitalEligible,
  capitalController.getMySummary
);
router.post(
  "/organizer/loans",
  authenticateUser,
  restrictTo("organizer"),
  requireCapitalEligible,
  capitalController.createLoanRequest
);
router.get(
  "/organizer/loans",
  authenticateUser,
  restrictTo("organizer"),
  capitalController.listMyLoans
);
router.get(
  "/organizer/loans/:id",
  authenticateUser,
  restrictTo("organizer"),
  capitalController.getMyLoan
);
router.patch(
  "/organizer/loans/:id/cancel",
  authenticateUser,
  restrictTo("organizer"),
  capitalController.cancelMyLoan
);

module.exports = router;
