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
  getPublicTicketDetails,
} = require("../controllers/ticketController");

const SantimPayService = require("../services/santimPayService");
const Payment = require("../models/Payment");
const Event = require("../models/Event");

// Public route - NO authentication middleware

router.post("/ticket/initiate", async (req, res) => {
  try {
    const {
      ticketDetails,
      amount,
      phoneNumber,
      method,
      orderId,
      paymentReason,
    } = req.body;

    if (!ticketDetails) {
      return res
        .status(400)
        .json({ success: false, error: "ticketDetails is required" });
    }

    const selectedEvent = await Event.findById(ticketDetails.eventId);
    if (!selectedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const reason =
      paymentReason ||
      `Ticket purchase: ${selectedEvent.title} - ${ticketDetails.ticketTypeId}`;
    const notifyUrl = `${
      process.env.BASE_URL || "http://localhost:5000"
    }/api/tickets`;

    // Use provided orderId or generate one
    const transactionId =
      orderId ||
      `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Call SantimPay directPayment via Service
    const response = await SantimPayService.directPayment(
      transactionId,
      amount,
      reason,
      notifyUrl,
      phoneNumber,
      method
    );

    console.log("SantimPay payment initiated:", response);

    // Save a “pending” payment record in your DB
    await Payment.create({
      transactionId: transactionId,
      status: "PENDING",
      guestName: ticketDetails.fullName,
      contact: phoneNumber,
      method: method,
      price: amount,
      eventId: ticketDetails.eventId,
      userId: ticketDetails.userId,
      ticketDetails: {
        ...ticketDetails,
        ticketType: ticketDetails.ticketTypeId,
        ticketCount: ticketDetails.quantity,
      },
    });

    // Return transactionId so frontend can poll
    res.json({
      success: true,
      transactionId: transactionId,
      message: "Payment initiated. Please check your phone.",
    });
  } catch (err) {
    console.error("Error initiating payment:", err);
    res.status(500).json({ success: false, error: "Could not start payment" });
  }
});

router.get("/event/:eventId", getEventTickets);
router.get("/invitation/:ticketId", getInvitationTicket);
router.patch("/invitation/:ticketId/status", updateInvitationTicketStatus);
router.post("/rsvp/:ticketId/confirm", confirmRSVP);
router.get("/public/details/:id", getPublicTicketDetails);

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
