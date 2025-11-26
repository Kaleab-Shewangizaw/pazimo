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
} = require("../controllers/invitationController");

const {
  initiateInvitationPayment,
  checkInvitationPaymentStatus,
  invitationWebhook,
} = require("../controllers/invitationPaymentController");

// Invitation Payment Routes
router.post(
  "/invitations/payment/initiate",
  protect,
  initiateInvitationPayment
);
router.get(
  "/invitations/payment/status/:transactionId",
  checkInvitationPaymentStatus
);
router.post("/invitations/payment/webhook", invitationWebhook);

// Create pending invitation (Single)
router.post("/invitations/pending", protect, createPendingInvitation);

// Bulk create invitations (Step 1: Create pending)
router.post("/invitations/bulk-create", protect, createBulkInvitations);

// Send invitations / Process paid (Step 2: Generate QR & Send)
router.post("/invitations/send", protect, processPaidInvitationsEndpoint);
router.post(
  "/invitations/process-paid",
  protect,
  processPaidInvitationsEndpoint
);

// Verify invitation scan
router.post("/invitations/verify", verifyInvitation);

// Get Invitation by ID (Public)
router.get("/invitations/:id", getInvitationById);

// Update Invitation Status (Public - for guest confirmation)
router.patch("/invitations/:id/status", updateInvitationStatus);

// Create invitation (Legacy/Single) - Updated to match new schema if possible, or keep as is but might need frontend update
router.post("/invitations", protect, async (req, res) => {
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
    };

    const invitation = new Invitation(invitationData);
    await invitation.save();
    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get invitations by organizer
router.get("/invitations/organizer/:organizerId", protect, async (req, res) => {
  try {
    const invitations = await Invitation.find({
      organizerId: req.params.organizerId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get invitations by event ID
router.get("/invitations/event/:eventId", protect, async (req, res) => {
  try {
    const invitations = await Invitation.find({
      eventId: req.params.eventId,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
