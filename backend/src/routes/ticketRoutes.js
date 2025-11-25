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
  createInvitationTicket,
  getInvitationTicket,
  updateInvitationTicketStatus,
  createGuestTicket,
  sendGuestInvitation,
  confirmRSVP,
} = require("../controllers/ticketController");

// Public route - NO authentication middleware
router.get("/event/:eventId", getEventTickets);
router.get("/invitation/:ticketId", getInvitationTicket);
router.patch("/invitation/:ticketId/status", updateInvitationTicketStatus);
router.post("/rsvp/:ticketId/confirm", confirmRSVP);

// All other routes use authentication
router.use(authenticateUser);

// Protected routes
router.post("/", createTicket);
router.post("/invite", createInvitationTicket);
router.post("/guest-ticket", createGuestTicket);
router.post("/guest-ticket/send", sendGuestInvitation);
router.get("/my-tickets", getUserTickets);
router.get("/details/:id", getTicketDetails);
router.get("/:ticketId", getTicket);
router.patch("/:ticketId/cancel", cancelTicket);
router.post("/validate-qr", validateQRCode);
router.patch("/:ticketId/check-in", checkInTicket);
router.get("/admin/all", getAllTicketsAdmin);

module.exports = router;
