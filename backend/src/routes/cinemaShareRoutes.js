const express = require("express");
const router = express.Router();

const { authenticateUser } = require("../middlewares/auth");
const {
  ticketShareSearchLimiter,
  ticketShareWriteLimiter,
} = require("../middlewares/rateLimiters");
const {
  searchRecipients,
  listContacts,
  createShare,
  listShares,
  getShare,
  acceptShare,
  declineShare,
  cancelShare,
} = require("../controllers/cinemaShareController");

// Mirrors routes/beverageShareRoutes.js exactly, including reuse of its rate
// limiters — a generic per-IP budget on "search the user directory" /
// "create or respond to a transfer" that has nothing cinema-specific about it.
router.use(authenticateUser);

router.get("/search", ticketShareSearchLimiter, searchRecipients);
router.get("/contacts", listContacts);

router.post("/", ticketShareWriteLimiter, createShare);
router.get("/", listShares);
router.get("/:shareId", getShare);
router.post("/:shareId/accept", ticketShareWriteLimiter, acceptShare);
router.post("/:shareId/decline", ticketShareWriteLimiter, declineShare);
router.post("/:shareId/cancel", ticketShareWriteLimiter, cancelShare);

module.exports = router;
