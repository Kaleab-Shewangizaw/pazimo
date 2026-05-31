const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth");
const upload = require("../middlewares/upload");
const rsvpController = require("../controllers/rsvpController");

router.get("/public/forms", rsvpController.listPublishedForms);
router.get("/public/:publicId", rsvpController.getFormByPublicId);
router.post("/public/:publicId/responses", rsvpController.submitResponse);
router.post("/responses/validate-qr", protect, restrictTo("admin", "organizer", "partner"), rsvpController.validateRsvpQr);
router.patch("/responses/:responseId/check-in", protect, restrictTo("admin", "organizer", "partner"), rsvpController.checkInRsvpResponse);

router.use(protect, restrictTo("admin", "organizer", "partner"));

router.get("/forms", rsvpController.listForms);
router.post("/forms", rsvpController.createForm);
router.get("/forms/:id", rsvpController.getForm);
router.post("/forms/:id/responses", rsvpController.submitResponseByFormId);
router.patch("/forms/:id", rsvpController.updateForm);
router.patch("/forms/:id/cover-image", upload.single("coverImage"), rsvpController.uploadCoverImage);
router.delete("/forms/:id", rsvpController.deleteForm);
router.post("/forms/:id/duplicate", rsvpController.duplicateForm);
router.patch("/forms/:id/publish", rsvpController.publishForm);
router.patch("/forms/:id/cancel", rsvpController.cancelForm);
router.patch("/forms/:id/featured", rsvpController.toggleFeaturedForm);
router.patch("/forms/:id/trending", rsvpController.toggleTrendingForm);
router.patch("/forms/:id/banner", rsvpController.toggleBannerForm);
router.patch("/forms/:id/visibility", rsvpController.toggleVisibilityForm);
router.patch("/forms/:id/archive", rsvpController.archiveForm);
router.get("/forms/:id/responses", rsvpController.listResponses);
router.get("/forms/:id/analytics", rsvpController.getAnalytics);
router.post("/forms/:id/messages", rsvpController.sendResponseMessage);
router.patch("/forms/:id/responses/:responseId/tag", rsvpController.updateResponseTag);
router.patch("/forms/:id/responses/:responseId/status", rsvpController.updateResponseStatus);

router.patch("/:id/publish", rsvpController.publishForm);
router.patch("/:id/cancel", rsvpController.cancelForm);
router.patch("/:id/featured", rsvpController.toggleFeaturedForm);
router.patch("/:id/trending", rsvpController.toggleTrendingForm);
router.patch("/:id/banner", rsvpController.toggleBannerForm);
router.patch("/:id/visibility", rsvpController.toggleVisibilityForm);
router.patch("/:id/archive", rsvpController.archiveForm);
router.delete("/:id", rsvpController.deleteForm);

module.exports = router;
