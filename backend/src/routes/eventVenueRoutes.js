const express = require("express");

const router = express.Router();

const eventVenueController = require("../controllers/eventVenueController");
const upload = require("../middlewares/upload");
const { authenticateUser, restrictTo } = require("../middlewares/auth");

// The event-venue directory's API — a plain admin-curated list of physical
// places, with one public read surface. There is no self-service side: unlike
// Cinema and Venue, no account owns a row here, so every write is admin-only.
//
//   /public/*  — anonymous, read-only
//   /admin/*   — admin only
//
// "public" is a literal segment declared before /admin/:id so it is never
// captured as a venue id, matching the convention in cinemaRoutes.js.

const adminOnly = [authenticateUser, restrictTo("admin")];

router.get("/public", eventVenueController.listPublicVenues);

router.get("/admin", ...adminOnly, eventVenueController.listVenues);
router.post("/admin", ...adminOnly, upload.single("image"), eventVenueController.createVenue);
router.get("/admin/:id", ...adminOnly, eventVenueController.getVenue);
router.patch("/admin/:id", ...adminOnly, upload.single("image"), eventVenueController.updateVenue);
router.patch("/admin/:id/status", ...adminOnly, eventVenueController.setVenueStatus);
router.delete("/admin/:id", ...adminOnly, eventVenueController.deleteVenue);

module.exports = router;
