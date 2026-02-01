const express = require("express");
const router = express.Router();
const Invitation = require("../models/Invitation");
const { protect } = require("../middlewares/auth");
const {
  createBulkInvitations,
  verifyInvitation,
  processPaidInvitationsEndpoint,
  getInvitationById,
  updateInvitationStatus,
  createPendingInvitation,
  getInvitationsByEvent,
  getAllInvitations,
  deleteInvitation,
} = require("../controllers/invitationController");

const {
  initiateInvitationPayment,
  initiateChapaInvitationPayment,
  checkInvitationPaymentStatus,
  invitationWebhook,
  cancelInvitationPayment,
} = require("../controllers/invitationPaymentController");

// Invitation Payment Routes
router.post(
  "/payment/initiate",
  protect,
  initiateInvitationPayment
);
router.post(
  "/payment/initiate/chapa",
  protect,
  initiateChapaInvitationPayment
);
router.post("/payment/cancel", protect, cancelInvitationPayment);
router.get(
  "/payment/status/:transactionId",
  checkInvitationPaymentStatus
);
router.post("/payment/webhook", invitationWebhook);

// Create pending invitation (Single)
router.post("/pending", protect, createPendingInvitation);

// Bulk create invitations (Step 1: Create pending)
router.post("/bulk-create", protect, createBulkInvitations);

// Send invitations / Process paid (Step 2: Generate QR & Send)
router.post("/send", protect, processPaidInvitationsEndpoint);
router.post(
  "/process-paid",
  protect,
  processPaidInvitationsEndpoint
);

// Verify invitation scan
router.post("/verify", verifyInvitation);

// Get Invitation by ID (Public)
router.get("/:id", getInvitationById);

// Update Invitation Status (Public - for guest confirmation)
router.patch("/:id/status", updateInvitationStatus);

// Create invitation (Legacy/Single) - Updated to match new schema if possible, or keep as is but might need frontend update
router.post("/", protect, async (req, res) => {
  try {
    // Map legacy fields if necessary or expect new fields
    let type = req.body.type || req.body.contactType || "email";
    if (type === "phone") type = "sms";

    const invitationData = {
      ...req.body,
      organizerId: req.user._id,
      // Ensure defaults
      amount: req.body.amount || req.body.qrCodeCount || 1,
      guestName: req.body.guestName || req.body.customerName,
      guestEmail:
        req.body.guestEmail ||
        (req.body.contactType === "email" ? req.body.contact : undefined),
      guestPhone:
        req.body.guestPhone ||
        (req.body.contactType === "phone" ? req.body.contact : undefined),
      type: type,
      guestType: req.body.guestType || "guest",
      ticketType: req.body.ticketType || "Regular",
    };

    const invitation = new Invitation(invitationData);
    await invitation.save();
    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get invitations by organizer
router.get("/organizer/:organizerId", protect, async (req, res) => {
  try {
    const invitations = await Invitation.find({
      organizerId: req.params.organizerId,
    })
      .sort({ createdAt: -1 })
      .populate("eventId", "title");

    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitations by event ID
router.get("/invitations/event/:eventId", protect, getInvitationsByEvent);

// Get all invitations (Admin or specific organizer)
router.get("/invitations", protect, async (req, res) => {
  try {
    // Admins can see all invitations, others can see only theirs
    const query =
      req.user.role === "admin" ? {} : { organizerId: req.user._id };
    const invitations = await Invitation.find(query)
      .sort({ createdAt: -1 })
      .populate("eventId", "title");

    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all invitations (Admin)
router.get("/invitations/admin/all", protect, getAllInvitations);

// Delete invitation (Admin/Organizer)
router.delete("/invitations/:id", protect, deleteInvitation);

module.exports = router;
