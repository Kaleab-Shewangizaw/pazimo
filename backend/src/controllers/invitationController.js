const Invitation = require("../models/Invitation");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const InvitationPricing = require("../models/InvitationPricing");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const { StatusCodes } = require("http-status-codes");
const {
  sendInvitationEmail,
  createEmailTemplate,
} = require("./invitationEmailController");
const axios = require("axios");

// Helper to validate and fix rows
const validateBulkRows = (rows, eventId) => {
  const correctedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const corrected = { ...row };

    // Fix amount
    let amount = parseInt(row.amount || row.Amount || row.qrCodecount, 10);
    if (isNaN(amount) || amount < 1) amount = 1;
    if (amount > 10) amount = 10;
    corrected.amount = amount;

    // Normalize keys
    corrected.guestName = row.guestName || row.Name || "Guest";
    corrected.guestEmail = row.guestEmail || row.Email;
    corrected.guestPhone = row.guestPhone || row.Phone;

    // Normalize type
    let type = (row.type || row.Type || "").toLowerCase();
    if (!["email", "sms", "both"].includes(type)) {
      if (corrected.guestEmail && corrected.guestPhone) type = "both";
      else if (corrected.guestEmail) type = "email";
      else if (corrected.guestPhone) type = "sms";
      else type = "email"; // Default
    }
    corrected.type = type;

    // Validate contact
    if (type === "email" && !corrected.guestEmail) {
      errors.push(`Row ${index + 1}: Email required for email invitation`);
      return;
    }
    if (type === "sms" && !corrected.guestPhone) {
      errors.push(`Row ${index + 1}: Phone required for SMS invitation`);
      return;
    }

    corrected.eventId = eventId;
    correctedRows.push(corrected);
  });

  return { correctedRows, errors };
};

// Create bulk invitations (Pending Payment)
const createBulkInvitations = async (req, res) => {
  try {
    const { rows, eventId } = req.body;
    const organizerId = req.user._id;

    if (!eventId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Event ID is required",
      });
    }

    // Verify event ownership
    const event = await Event.findOne({ _id: eventId, organizer: organizerId });
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found or unauthorized",
      });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid rows data",
      });
    }

    const { correctedRows, errors } = validateBulkRows(rows, eventId);

    if (correctedRows.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "No valid rows found",
        errors,
      });
    }

    // Fetch pricing for the event type
    const eventType = event.eventType || "public";
    const pricing = await InvitationPricing.findOne({ eventType });
    const emailPrice = pricing ? pricing.emailPrice : 2; // Default fallback
    const smsPrice = pricing ? pricing.smsPrice : 5; // Default fallback

    // Calculate costs
    let totalCost = 0;
    const invitationsToCreate = correctedRows.map((row) => {
      let cost = 0;
      if (row.type === "email") cost = emailPrice;
      else if (row.type === "sms") cost = smsPrice;
      else if (row.type === "both") cost = emailPrice + smsPrice;

      // Multiply by amount if pricing is per ticket, otherwise per invitation
      // Assuming per invitation for delivery cost
      totalCost += cost * row.amount;

      return {
        ...row,
        organizerId,
        status: "pending_payment",
        paymentStatus: "pending",
        invitationId: uuidv4(),
      };
    });

    // Create invitations
    const invitations = await Invitation.insertMany(invitationsToCreate);
    const invitationIds = invitations.map((inv) => inv.invitationId);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: `${invitations.length} invitations created. Payment required.`,
      data: {
        invitationIds,
        count: invitations.length,
        totalCost,
        errors,
      },
    });
  } catch (error) {
    console.error("Create bulk invitations error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create invitations",
      error: error.message,
    });
  }
};

// Process paid invitations (Generate QR, Send Email/SMS)
const processPaidInvitations = async (invitationIds, paymentReference) => {
  const results = {
    success: [],
    failed: [],
  };

  for (const invId of invitationIds) {
    try {
      const invitation = await Invitation.findOne({ invitationId: invId });
      if (!invitation) continue;

      // Skip if already sent to avoid duplicates
      if (invitation.status === "sent" || invitation.paymentStatus === "paid")
        continue;

      const event = await Event.findById(invitation.eventId);
      if (!event) throw new Error("Event not found");

      let ticket = null;
      let qrCodeBase64 = "";
      let uniqueId = invitation.invitationId;

      // Only create a ticket if it's a GUEST invitation (free)
      if (invitation.guestType !== "paid") {
        ticket = await Ticket.create({
          event: invitation.eventId,
          isInvitation: true,
          guestName: invitation.guestName,
          guestEmail: invitation.guestEmail,
          guestPhone: invitation.guestPhone,
          ticketType: "Guest Ticket",
          ticketCount: invitation.amount, // Use amount from bulk data
          price: 0, // Free ticket
          status: "active",
          paymentStatus: "completed",
          paymentReference: paymentReference || invitation.paymentReference,
        });
        uniqueId = ticket.ticketId;
        qrCodeBase64 = ticket.qrCode;
      }

      // Generate RSVP/Guest Link
      const frontendUrl =
        process.env.FRONTEND_URL || "https://pazimo.vercel.app";

      let actionLink;
      let actionText;

      if (invitation.guestType === "paid") {
        actionLink = `${frontendUrl}/event_detail?id=${event._id}`;
        actionText = "Buy Ticket";
      } else {
        actionLink = `${frontendUrl}/guest-invitation?inv=${uniqueId}`;
        actionText = "Confirm Attendance";
      }

      const rsvpLink = actionLink;

      // Update Invitation
      if (ticket) {
        invitation.qrCodeData = ticket.qrCode; // Sync QR code
      }
      invitation.rsvpLink = rsvpLink;
      invitation.paymentStatus = "paid";
      invitation.status = "sent";
      if (paymentReference) {
        invitation.paymentReference = paymentReference;
      }
      await invitation.save();

      // Send Email
      if (
        ["email", "both"].includes(invitation.type) &&
        invitation.guestEmail
      ) {
        const eventData = {
          title: event.title,
          date: event.startDate,
          location:
            typeof event.location === "string"
              ? event.location
              : event.location?.address || "See map",
        };

        const invitationData = {
          guestName: invitation.guestName,
          ticketType: "Guest Ticket",
          uniqueId: uniqueId,
          actionLink: actionLink,
          actionText: actionText,
        };

        const eventImage =
          event.coverImages && event.coverImages.length > 0
            ? event.coverImages[0]
            : "";

        const emailHtml = createEmailTemplate(
          eventData,
          invitationData,
          qrCodeBase64,
          eventImage
        );

        await sendInvitationEmail({
          to: invitation.guestEmail,
          subject: `You're invited to ${event.title}!`,
          body: emailHtml,
          // attachments: [
          //   {
          //     filename: "ticket-qr.png",
          //     content: qrCodeBase64.split(";base64,").pop(),
          //     encoding: "base64",
          //   },
          // ],
        });
      }

      // Send SMS
      if (["sms", "both"].includes(invitation.type) && invitation.guestPhone) {
        const message = `Hi ${invitation.guestName}\n\nEvent: ${
          event.title
        }\nTime: ${event.startTime}\nLocation: ${
          typeof event.location === "string"
            ? event.location
            : event.location?.address || "See map"
        }\n\nRsvp Link: ${rsvpLink}`;

        // Call SMS API (GeezSMS)
        let phone = invitation.guestPhone.replace("+", "");
        // Ensure phone starts with 251
        if (phone.startsWith("0")) {
          phone = "251" + phone.substring(1);
        } else if (!phone.startsWith("251")) {
          phone = "251" + phone;
        }

        await axios
          .post("https://api.geezsms.com/api/v1/sms/send", {
            phone: phone,
            msg: message,
            token:
              process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
          })
          .catch((err) =>
            console.error("SMS Error:", err.response?.data || err.message)
          );
      }

      results.success.push({
        invitationId: invitation.invitationId,
        ticketId: ticket.ticketId,
        status: "sent",
      });
    } catch (error) {
      console.error(`Failed to process invitation ${invId}:`, error);
      results.failed.push({ id: invId, error: error.message });

      await Invitation.findOneAndUpdate(
        { invitationId: invId },
        { status: "failed" }
      );
    }
  }

  return results;
};

// Verify Invitation (Scan)
const verifyInvitation = async (req, res) => {
  try {
    const { qrData } = req.body;

    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (e) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid QR data format",
      });
    }

    const { invitationId } = parsedData;
    const invitation = await Invitation.findOne({ invitationId });

    if (!invitation) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Invitation not found",
      });
    }

    if (invitation.amount <= 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Ticket already used / No admissions remaining",
        data: { remaining: 0 },
      });
    }

    // Decrease amount
    invitation.amount -= 1;
    if (invitation.amount === 0) {
      invitation.status = "delivered";
    }
    await invitation.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Valid Ticket",
      data: {
        remaining: invitation.amount,
        guestName: invitation.guestName,
        type: invitation.type,
      },
    });
  } catch (error) {
    console.error("Verify invitation error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Verification failed",
    });
  }
};

// Endpoint to trigger sending (called after payment)
const processPaidInvitationsEndpoint = async (req, res) => {
  try {
    const { invitationIds } = req.body;

    if (!invitationIds || !Array.isArray(invitationIds)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "invitationIds array is required",
      });
    }

    // In a real app, verify payment status here before sending
    // const invitations = await Invitation.find({ invitationId: { $in: invitationIds } });
    // if (invitations.some(inv => inv.paymentStatus !== 'paid')) ...

    const results = await processPaidInvitations(invitationIds);

    res.status(StatusCodes.OK).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Send invitations error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send invitations",
    });
  }
};

// Get Invitation by ID (Public for Guest View)
const getInvitationById = async (req, res) => {
  try {
    const { id } = req.params; // This is the invitationId (UUID)

    const invitation = await Invitation.findOne({ invitationId: id });

    if (!invitation) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Invitation not found",
      });
    }

    // Fetch event details
    const event = await Event.findById(invitation.eventId);
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found",
      });
    }

    // Return combined data safe for public view
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        invitationId: invitation.invitationId,
        guestName: invitation.guestName,
        guestEmail: invitation.guestEmail,
        guestPhone: invitation.guestPhone,
        amount: invitation.amount,
        status: invitation.status,
        qrCodeData: invitation.qrCodeData,
        event: {
          title: event.title,
          startDate: event.startDate,
          startTime: event.startTime,
          location: event.location,
          description: event.description,
          organizerName: event.organizerName, // Assuming this exists or populate organizer
        },
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch invitation",
    });
  }
};

// Update Invitation Status (Confirm/Decline)
const updateInvitationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["confirmed", "declined"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid status. Must be 'confirmed' or 'declined'",
      });
    }

    const invitation = await Invitation.findOne({ invitationId: id });

    if (!invitation) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Invitation not found",
      });
    }

    invitation.status = status;

    // If declined, delete the associated ticket
    if (status === "declined") {
      // Try to find ticket by paymentReference (transactionId)
      if (invitation.paymentReference) {
        await Ticket.findOneAndDelete({
          paymentReference: invitation.paymentReference,
        });
      }
      // Fallback: Try to extract ticketId from rsvpLink
      else if (invitation.rsvpLink && invitation.rsvpLink.includes("inv=")) {
        const ticketId = invitation.rsvpLink.split("inv=")[1].split("&")[0];
        if (ticketId) {
          await Ticket.findOneAndDelete({ ticketId: ticketId });
        }
      }
    }

    await invitation.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Invitation ${status}`,
      data: {
        status: invitation.status,
      },
    });
  } catch (error) {
    console.error("Update invitation status error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update status",
    });
  }
};

// Create and send a single paid invitation (called from payment fulfillment)
const createAndSendProfessionalInvitation = async (data) => {
  try {
    const {
      eventId,
      organizerId,
      guestName,
      guestEmail,
      guestPhone,
      type,
      amount,
      message,
      guestType,
    } = data;

    const event = await Event.findById(eventId);
    if (!event) throw new Error("Event not found");

    const invitationId = uuidv4();
    let ticket = null;
    let qrCodeBase64 = "";
    let uniqueId = invitationId;

    if (guestType !== "paid") {
      // Create Ticket
      ticket = await Ticket.create({
        event: eventId,
        isInvitation: true,
        guestName,
        guestEmail,
        guestPhone,
        ticketType: "Guest Ticket",
        ticketCount: parseInt(amount) || 1,
        price: 0,
        status: "active",
        paymentStatus: "completed",
      });
      uniqueId = ticket.ticketId;
      qrCodeBase64 = ticket.qrCode;
    } else {
      // Generate QR Data
      const qrPayload = {
        invitationId,
        eventId,
        type: "guest_ticket",
      };
      const qrDataString = JSON.stringify(qrPayload);
      qrCodeBase64 = await QRCode.toDataURL(qrDataString);
    }

    // Generate RSVP Link
    const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.vercel.app";

    let actionLink;
    let actionText;

    if (guestType === "paid") {
      actionLink = `${frontendUrl}/event_detail?id=${eventId}`;
      actionText = "Buy Ticket";
    } else {
      actionLink = `${frontendUrl}/guest-invitation?inv=${uniqueId}`;
      actionText = "Confirm Attendance";
    }

    const rsvpLink = actionLink;

    // Map type if needed (phone -> sms)
    let contactType = type;
    if (contactType === "phone") contactType = "sms";

    // Create Invitation Record
    const invitation = await Invitation.create({
      invitationId,
      eventId,
      organizerId,
      guestName,
      guestEmail,
      guestPhone,
      type: contactType,
      guestType: guestType || "guest",
      amount: parseInt(amount) || 1,
      status: "sent",
      paymentStatus: "paid",
      qrCodeData: qrCodeBase64,
      rsvpLink,
    });

    // Send Email
    if (["email", "both"].includes(contactType) && guestEmail) {
      const eventData = {
        title: event.title,
        date: event.startDate,
        location:
          typeof event.location === "string"
            ? event.location
            : event.location?.address || "See map",
      };

      const invitationData = {
        guestName,
        ticketType: "Guest Ticket",
        uniqueId: uniqueId,
        actionLink: actionLink,
        actionText: actionText,
      };

      const eventImage =
        event.coverImages && event.coverImages.length > 0
          ? event.coverImages[0]
          : "";

      const emailHtml = createEmailTemplate(
        eventData,
        invitationData,
        qrCodeBase64,
        eventImage
      );

      await sendInvitationEmail({
        to: guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
        // attachments: [
        //   {
        //     filename: "ticket-qr.png",
        //     content: qrCodeBase64.split(";base64,").pop(),
        //     encoding: "base64",
        //   },
        // ],
      });
    }

    // Send SMS
    if (["sms", "both"].includes(contactType) && guestPhone) {
      const smsMessage = `Hi ${guestName}\nEvent: ${event.title}\nTime: ${
        event.startTime
      }\nLocation: ${
        typeof event.location === "string"
          ? event.location
          : event.location?.address || "See map"
      }\n\nRsvp Link: ${rsvpLink}`;

      let phone = guestPhone.replace("+", "");
      // Ensure phone starts with 251
      if (phone.startsWith("0")) {
        phone = "251" + phone.substring(1);
      } else if (!phone.startsWith("251")) {
        phone = "251" + phone;
      }

      await axios
        .post("https://api.geezsms.com/api/v1/sms/send", {
          phone: phone,
          msg: smsMessage,
          token:
            process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
        })
        .catch((err) =>
          console.error("SMS Error:", err.response?.data || err.message)
        );
    }

    return invitation;
  } catch (error) {
    console.error("Error creating professional invitation:", error);
    throw error;
  }
};

// Create a single pending invitation
const createPendingInvitation = async (req, res) => {
  try {
    const {
      eventId,
      guestName,
      guestEmail,
      guestPhone,
      type,
      amount,
      message,
      guestType,
    } = req.body;
    const organizerId = req.user._id;

    const event = await Event.findOne({ _id: eventId, organizer: organizerId });
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found or unauthorized",
      });
    }

    // Map type if needed (phone -> sms)
    let contactType = type;
    if (contactType === "phone") contactType = "sms";

    const invitationId = uuidv4();

    const invitation = await Invitation.create({
      invitationId,
      eventId,
      organizerId,
      guestName,
      guestEmail,
      guestPhone,
      type: contactType,
      guestType: guestType || "guest",
      amount: parseInt(amount) || 1,
      status: "pending_payment",
      paymentStatus: "pending",
      message,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    console.error("Create pending invitation error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create invitation",
      error: error.message,
    });
  }
};

module.exports = {
  createBulkInvitations,
  processPaidInvitations,
  verifyInvitation,
  processPaidInvitationsEndpoint,
  sendInvitations: processPaidInvitationsEndpoint, // Alias for backward compatibility
  getInvitationById,
  updateInvitationStatus,
  createAndSendProfessionalInvitation,
  createPendingInvitation,
};
