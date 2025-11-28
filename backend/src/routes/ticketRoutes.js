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
  cancelPaymentIntent,
} = require("../controllers/ticketController");

const SantimPayService = require("../services/santimPayService");
const User = require("../models/User");
const Event = require("../models/Event");
const Payment = require("../models/Payment");

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

    // --- User Creation / Lookup Logic ---
    let userId = ticketDetails.userId;
    let token = null;
    let user = null;

    // If no userId provided (guest checkout), try to find or create user
    if (!userId) {
      const email = ticketDetails.email;
      const phone = phoneNumber; // Use the payment phone number

      // 1. Check by email first (Priority 1)
      if (email) {
        user = await User.findOne({ email: email });
      }

      // 2. If not found by email, check by phone (Priority 2)
      if (!user && phone) {
        user = await User.findOne({ phoneNumber: phone });
      }

      // 3. If still not found, create new user
      if (!user && email && phone) {
        try {
          const splitName = (ticketDetails.fullName || "Guest User").split(" ");
          const firstName = splitName[0];
          const lastName = splitName.slice(1).join(" ") || "User";
          // Use phone number as password as requested
          const password = phone;

          user = await User.create({
            firstName,
            lastName,
            email,
            phoneNumber: phone,
            password: password,
            role: "customer",
            isPhoneVerified: true, // Assume verified since they are paying with it
            isActive: true,
          });
          console.log(`Auto-created user ${user._id} during initiation`);
        } catch (err) {
          console.error("Failed to auto-create user:", err.message);
          // If creation fails (e.g. duplicate email but different phone), we proceed as guest
        }
      }

      if (user) {
        userId = user._id;
        // Generate token for auto-login
        token = user.createJWT();
      }
    }
    // ------------------------------------

    const selectedEvent = await Event.findById(ticketDetails.eventId);
    if (!selectedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const reason =
      paymentReason ||
      `Ticket purchase: ${selectedEvent.title} - ${ticketDetails.ticketTypeId}`;
    const notifyUrl = `${
      process.env.BACKEND_URL || "http://localhost:5000"
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
      userId: userId, // Use the found/created userId
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
      token: token, // Return token to frontend
      user: user
        ? {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
          }
        : null,
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
router.post("/payment/cancel", cancelPaymentIntent);

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
