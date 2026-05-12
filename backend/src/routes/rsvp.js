const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middlewares/auth");
const rsvpController = require("../controllers/rsvpController");

router.get("/public/:publicId", rsvpController.getFormByPublicId);
router.post("/public/:publicId/responses", rsvpController.submitResponse);

router.use(protect, restrictTo("admin", "organizer", "partner"));

router.get("/forms", rsvpController.listForms);
router.post("/forms", rsvpController.createForm);
router.get("/forms/:id", rsvpController.getForm);
router.patch("/forms/:id", rsvpController.updateForm);
router.delete("/forms/:id", rsvpController.deleteForm);
router.post("/forms/:id/duplicate", rsvpController.duplicateForm);
router.patch("/forms/:id/publish", rsvpController.publishForm);
router.get("/forms/:id/responses", rsvpController.listResponses);
router.get("/forms/:id/analytics", rsvpController.getAnalytics);
router.patch("/forms/:id/responses/:responseId/tag", rsvpController.updateResponseTag);

module.exports = router;