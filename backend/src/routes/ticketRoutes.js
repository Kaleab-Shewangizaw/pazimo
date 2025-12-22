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
  createOnDoorTicket,
} = require("../controllers/ticketController");

const SantimPayService = require("../services/santimPayService");
const ChapaService = require("../services/chapaService");
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
    }/api/webhook/santimpay`;

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

// Chapa Payment Initiation Route
router.post("/ticket/initiate/chapa", async (req, res) => {
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

    // --- User Creation / Lookup Logic (Same as SantimPay) ---
    let userId = ticketDetails.userId;
    let token = null;
    let user = null;

    if (!userId) {
      const email = ticketDetails.email;
      const phone = phoneNumber;

      if (email) {
        user = await User.findOne({ email: email });
      }

      if (!user && phone) {
        user = await User.findOne({ phoneNumber: phone });
      }

      if (!user && email && phone) {
        try {
          const splitName = (ticketDetails.fullName || "Guest User").split(" ");
          const firstName = splitName[0];
          const lastName = splitName.slice(1).join(" ") || "User";
          const password = phone;

          user = await User.create({
            firstName,
            lastName,
            email,
            phoneNumber: phone,
            password: password,
            role: "customer",
            isPhoneVerified: true,
            isActive: true,
          });
        } catch (err) {
          console.error("Failed to auto-create user:", err.message);
        }
      }

      if (user) {
        userId = user._id;
        token = user.createJWT();
      }
    }

    const selectedEvent = await Event.findById(ticketDetails.eventId);
    if (!selectedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    const reason =
      paymentReason ||
      `Ticket purchase: ${selectedEvent.title} - ${ticketDetails.ticketTypeId}`;

    // Chapa specific URLs
    const chapaCallbackUrl = `${
      process.env.BACKEND_URL || "http://localhost:5000"
    }/api/webhook/chapa`;
    const returnUrl =
      req.body.successUrl ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/success`;

    const transactionId =
      orderId ||
      `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Call Chapa Direct Charge
    let response;
    try {
      // Ensure mobile number format for Chapa (09... or 07...)
      let chapaMobile = phoneNumber.replace(/^\+/, "");
      if (chapaMobile.startsWith("251")) {
        chapaMobile = "0" + chapaMobile.substring(3);
      }

      response = await ChapaService.directCharge({
        amount: String(amount),
        currency: "ETB",
        mobile: chapaMobile,
        type: method, // "telebirr", "mpesa", etc.
        email: user ? user.email : "guest@example.com",
        first_name: ticketDetails.fullName.split(" ")[0],
        last_name: ticketDetails.fullName.split(" ")[1] || "User",
        tx_ref: transactionId,
        callback_url: chapaCallbackUrl,
        return_url: returnUrl,
        customization: {
          title: reason,
          description: "Ticket Purchase",
        },
      });
    } catch (error) {
      console.error("Chapa Direct Charge Error:", error);
      return res.status(400).json({
        success: false,
        error: error.message || "Payment initiation failed",
      });
    }

    if (response.status !== "success") {
      console.error("Chapa Direct Charge Failed:", response);
      return res.status(400).json({
        success: false,
        error: response.message || "Payment initiation failed",
      });
    }

    let checkoutUrl = null;
    // Direct charge might return checkout_url for some methods or just success
    if (
      response.status === "success" &&
      response.data &&
      response.data.checkout_url
    ) {
      checkoutUrl = response.data.checkout_url;
    }

    console.log("Chapa payment initiated:", response);

    // Save Payment Record
    await Payment.create({
      transactionId: transactionId,
      status: "PENDING",
      guestName: ticketDetails.fullName,
      contact: phoneNumber,
      method: method,
      provider: "chapa",
      price: amount,
      eventId: ticketDetails.eventId,
      userId: userId,
      ticketDetails: {
        ...ticketDetails,
        ticketType: ticketDetails.ticketTypeId,
        ticketCount: ticketDetails.quantity,
      },
    });

    // Return response matching SantimPay shape
    res.json({
      success: true,
      transactionId: transactionId,
      checkoutUrl: checkoutUrl,
      message: "Redirecting to payment...",
      token: token,
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
    console.error("Error initiating Chapa payment:", err);
    res.status(500).json({ success: false, error: "Could not start payment" });
  }
});

router.get("/event/:eventId", getEventTickets);
router.get("/invitation/:ticketId", getInvitationTicket);
router.patch("/invitation/:ticketId/status", updateInvitationTicketStatus);
router.post("/rsvp/:ticketId/confirm", confirmRSVP);
router.get("/public/details/:id", getPublicTicketDetails);
router.post("/payment/cancel", cancelPaymentIntent);
router.patch("/:ticketId/check-in", checkInTicket);
router.post("/validate-qr", validateQRCode);

// All other routes use authentication
router.use(authenticateUser);

// Protected routes
router.post("/", createTicket);
router.post("/on-door", createOnDoorTicket);
router.post("/invite", createInvitationTicket);
router.post("/guest-ticket", createGuestTicket);
router.post("/guest-ticket/send", sendGuestInvitation);
router.get("/my-tickets", getUserTickets);
router.get("/details/:id", getTicketDetails);
router.get("/:ticketId", getTicket);
router.patch("/:ticketId/cancel", cancelTicket);
router.get("/admin/all", getAllTicketsAdmin);

module.exports = router;
