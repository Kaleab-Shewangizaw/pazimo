const express = require("express");
const router = express.Router();
const { authenticateUser, protect } = require("../middlewares/auth");
const {
  createTicket,
  getUserTickets,
  getEventTickets,
  checkInTicket,
  cancelTicket,
  getTicket,
  getAllTicketsAdmin,
  validateQRCode,
  getTicketDetails,
} = require("../controllers/ticketController");

// Public route - NO authentication middleware
router.get("/event/:eventId", getEventTickets);

// All other routes use authentication
router.use(authenticateUser);

// Protected routes
router.post("/", createTicket);
router.get("/my-tickets", getUserTickets);
router.get("/details/:id", getTicketDetails);
router.get("/:ticketId", getTicket);
router.patch("/:ticketId/cancel", cancelTicket);
router.post("/validate-qr", validateQRCode);
router.patch("/:ticketId/check-in", checkInTicket);
router.get("/admin/all", getAllTicketsAdmin);

module.exports = router;
