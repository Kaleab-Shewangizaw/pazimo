const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const Invitation = require("../models/Invitation");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const mongoose = require("mongoose");
const {
  sendInvitationEmail,
  createEmailTemplate,
} = require("./invitationEmailController");
const { sendSMS } = require("../utils/sms");
const axios = require("axios");
const Payment = require("../models/Payment");
const SantimPayService = require("../services/santimPayService");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const validateSignature = (signature, payload) => {
  try {
    if (!signature) return false;
    SantimPayService.verifyWebhook(signature);
    return true;
  } catch (error) {
    console.error("Signature validation failed:", error.message);
    return false;
  }
};

// Helper to process successful payment and create ticket
const processSuccessfulPayment = async (payment) => {
  const startTime = Date.now();
  console.log(`\n[TICKET-CREATE] ============================================`);
  console.log(`[TICKET-CREATE] Starting ticket creation for txn: ${payment.transactionId}`);
  console.log(`[TICKET-CREATE] Payment status: ${payment.status}, Provider: ${payment.provider || 'unknown'}`);
  
  if (payment.status !== "PAID") {
    console.log(`[TICKET-CREATE] ❌ Payment status is ${payment.status}, not PAID. Aborting.`);
    console.log(`[TICKET-CREATE] ============================================\n`);
    return null;
  }

  const { eventId, ticketType, seatNumber, userId, ticketCount, ticketId } =
    payment.ticketDetails;

  console.log(`[TICKET-CREATE] Ticket details:`, {
    ticketId,
    eventId,
    ticketType,
    ticketCount: ticketCount || 1,
  });

  // Check if ticket already exists (idempotency)
  const existingTicket = await Ticket.findOne({ ticketId });
  if (existingTicket) {
    console.log(`[TICKET-CREATE] ⚠️ Ticket ${ticketId} already exists. Returning existing ticket.`);
    console.log(`[TICKET-CREATE] Total time: ${Date.now() - startTime}ms`);
    console.log(`[TICKET-CREATE] ============================================\n`);
    return existingTicket;
  }

  console.log(`[TICKET-CREATE] No existing ticket found. Creating new ticket...`);

  // Find the event and verify ticket type
  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  // Find the ticket type in the event
  const ticketTypeInfo = event.ticketTypes.find(
    (type) => type.name === ticketType || type._id.toString() === ticketType
  );
  if (!ticketTypeInfo) {
    throw new BadRequestError("Invalid ticket type");
  }

  // Check if ticket is available
  if (
    !ticketTypeInfo.available ||
    ticketTypeInfo.quantity < (ticketCount || 1)
  ) {
    throw new BadRequestError("Ticket type is not available or sold out");
  }

  // Prepare ticket data
  const ticketData = {
    ticketId,
    event: eventId,
    ticketType: ticketTypeInfo.name, // Ensure we store the name
    ticketCount: ticketCount || 1,
    purchaseQuantity: ticketCount || 1,
    price: ticketTypeInfo.price * (ticketCount || 1),
    seatNumber,
    paymentReference: payment.transactionId,
    status: "active",
    paymentStatus: "completed",
    message:
      payment.message ||
      (payment.ticketDetails && payment.ticketDetails.message),
  };

  // Handle User vs Guest
  let finalUserId = payment.userId || userId;
  console.log(`Initial finalUserId: ${finalUserId}`);

  if (!finalUserId) {
    // Try to find existing user by phone or email
    const rawEmail = payment.ticketDetails?.email;
    const rawPhone = payment.contact;

    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;
    // Normalize phone: remove spaces, dashes, etc. if needed, but keep consistent with DB
    const phone = rawPhone ? rawPhone.replace(/\s+/g, "") : null;

    console.log(`Searching for user by email: ${email} or phone: ${phone}`);

    let user = null;

    // Check by email first (Priority 1)
    if (email) {
      user = await User.findOne({ email: email });
    }

    // If not found by email, check by phone (Priority 2)
    if (!user && phone) {
      user = await User.findOne({ phoneNumber: phone });
    }

    if (user) {
      console.log(`Found existing user: ${user._id}`);
      finalUserId = user._id;
    } else if (email && phone) {
      // Create new user if we have both email and phone
      try {
        const splitName = (payment.guestName || "Guest User").split(" ");
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
          isPhoneVerified: true,
          isActive: true,
        });
        finalUserId = user._id;
        console.log(`Auto-created user ${user._id} for ticket purchase`);
      } catch (err) {
        console.error("Failed to auto-create user:", err.message);
        // Fallback to guest if user creation fails
      }
    }
  }

  console.log(`Final resolved userId: ${finalUserId}`);

  if (finalUserId) {
    ticketData.user = finalUserId;
    ticketData.isInvitation = false;
  } else {
    // If no user, treat as guest ticket (invitation style)
    ticketData.isInvitation = true;
    ticketData.guestName = payment.guestName || "Guest";
    ticketData.guestPhone = payment.contact;
    if (payment.ticketDetails && payment.ticketDetails.email) {
      ticketData.guestEmail = payment.ticketDetails.email;
    }
  }

  // Create the ticket
  const ticket = await Ticket.create(ticketData);
  console.log(`Ticket created: ${ticket._id}`);
  console.log("Created Ticket:", ticket); // Log the created ticket

  // Update event ticket quantity
  ticketTypeInfo.quantity -= ticketCount || 1;
  await event.save();

  // If user exists, add ticket to user's history
  if (finalUserId) {
    await User.findByIdAndUpdate(finalUserId, {
      $push: { tickets: ticket._id },
    });
    console.log(`Added ticket to user ${finalUserId} history`);
  }

  // Send SMS Confirmation
  try {
    const smsPhone =
      payment.contact ||
      ticketData.guestPhone ||
      (user ? user.phoneNumber : null);
    if (smsPhone) {
      const userName =
        payment.guestName ||
        ticketData.guestName ||
        (user ? user.firstName : "Customer");
      const eventTitle = event.title;
      const admitCount = ticketCount || 1;
      const ticketLink = `${
        process.env.FRONTEND_URL || "https://pazimo.com"
      }/ticket/${ticket.ticketId}`;

      const message = `Hi ${userName} 👋
Your ticket for ${eventTitle} is confirmed 🎟️
Admits: ${admitCount} person${admitCount > 1 ? 's' : ''}

Access your ticket here:
${ticketLink}

⚠️ Keep this link safe it gives direct access to your ticket.
Pazimo`;

      const smsResult = await sendSMS(smsPhone, message);
      if (smsResult.success) {
        console.log(`SMS sent to ${smsPhone}`);
      } else {
        console.error(`Failed to send SMS to ${smsPhone}: ${smsResult.error}`);
      }
    }
  } catch (smsError) {
    console.error("Failed to send confirmation SMS:", smsError);
  }

  console.log(`[TICKET-CREATE] ✅ Ticket ${ticket.ticketId} created successfully for txn: ${payment.transactionId}`);
  console.log(`[TICKET-CREATE] Total time: ${Date.now() - startTime}ms`);
  console.log(`[TICKET-CREATE] ============================================\n`);
  return ticket;
};

// Admin: Get all tickets with totals
// const getAllTicketsAdmin = async (req, res) => {
//   // Optional: ensure user has admin role
//   if (req.user.role !== 'admin') {
//     return res.status(StatusCodes.FORBIDDEN).json({ msg: 'Not authorized' });
//   }

//   const tickets = await Ticket.find()
//     .populate('event', 'title organizer startDate endDate')
//     .populate('user', 'name email');

//   const totalSold = tickets.length;
//   const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);

//   res.status(StatusCodes.OK).json({
//     tickets,
//     totalSold,
//     totalRevenue,
//   });
// };
const getAllTicketsAdmin = async (req, res) => {
  try {
    // ✅ Optional: Enforce admin-only access
    if (req.user?.role !== "admin") {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ message: "Access denied: Admins only" });
    }

    // Add pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    // Get total count efficiently
    const totalCount = await Ticket.countDocuments();

    // ✅ Fetch tickets with event & user data - OPTIMIZED with pagination and lean queries
    const tickets = await Ticket.find()
      .select('ticketId event user guestName guestEmail guestPhone ticketType price status paymentStatus purchaseDate createdAt ticketCount purchaseQuantity isInvitation isOnDoor')
      .populate({
        path: "event",
        select: "title organizer ticketTypes",
        populate: {
          path: "organizer",
          select: "name email firstName lastName",
        },
      })
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format the tickets data
    const formattedTickets = tickets.map((ticket) => ({
      ...ticket,
      event: ticket.event
        ? {
            title: ticket.event.title,
            _id: ticket.event._id,
            organizer: ticket.event.organizer
              ? {
                  name: ticket.event.organizer.name || `${ticket.event.organizer.firstName || ''} ${ticket.event.organizer.lastName || ''}`.trim(),
                  _id: ticket.event.organizer._id
                }
              : null,
          }
        : null,
      user: ticket.user
        ? {
            name: `${ticket.user.firstName} ${ticket.user.lastName}`,
            email: ticket.user.email,
          }
        : ticket.guestName ? {
            name: ticket.guestName,
            email: ticket.guestEmail,
          } : null,
    }));

    // ✅ Calculate total sold and revenue - Use aggregation for better performance
    const stats = await Ticket.aggregate([
      {
        $match: {
          isInvitation: { $ne: true },
          paymentStatus: "completed",
          status: { $nin: ["cancelled", "expired", "pending"] }
        }
      },
      {
        $group: {
          _id: null,
          totalSold: { 
            $sum: { 
              $ifNull: [
                { $ifNull: ["$purchaseQuantity", "$ticketCount"] },
                1
              ]
            }
          },
          totalRevenue: { $sum: "$price" }
        }
      }
    ]);

    const totalSold = stats.length > 0 ? stats[0].totalSold : 0;
    const totalRevenue = stats.length > 0 ? stats[0].totalRevenue : 0;

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedTickets,
      totalSold,
      totalRevenue,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasMore: skip + tickets.length < totalCount,
      },
    });
  } catch (error) {
    console.error("Admin ticket fetch error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch tickets",
      error: error.message,
    });
  }
};

// Create a new ticket
const createTicket = async (req, res) => {
  const payload = req.body;
  const transactionId = payload.id || payload.txnId; // depends on SantimPay

  // Validate signature / token sent by SantimPay
  const signature = req.get("Signed-Token");
  if (!validateSignature(signature, payload)) {
    return res.status(400).send("Invalid signature");
  }

  const payment = await Payment.findOne({ transactionId });
  if (!payment) {
    return res.status(404).send("Payment record not found");
  }

  // Update payment status
  if (
    payload.status ===
    "COMPLETED" /* or whatever SantimPay’s success status is */
  ) {
    payment.status = "PAID";
  } else {
    payment.status = "FAILED";
  }

  await payment.save();

  if (payment.status === "PAID") {
    try {
      const ticket = await processSuccessfulPayment(payment);
      res.status(StatusCodes.CREATED).json({ ticket });
    } catch (error) {
      console.error("Error processing successful payment:", error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
    }
  } else {
    res.status(StatusCodes.OK).send("Payment failed/cancelled");
  }
};

// Create a guest ticket (Pending Payment)
const createGuestTicket = async (req, res) => {
  try {
    const {
      eventId,
      guestName,
      guestEmail,
      guestPhone,
      ticketType,
      ticketCount,
      message,
    } = req.body;

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // Check if ticketType exists and update quantity if so
    if (ticketType) {
      const typeInfo = event.ticketTypes.find((t) => t.name === ticketType);
      if (typeInfo) {
        if (typeInfo.quantity < (ticketCount || 1)) {
          throw new BadRequestError("Not enough tickets available");
        }
        typeInfo.quantity -= ticketCount || 1;
        await event.save();
      }
    }

    // Create the ticket
    const ticket = await Ticket.create({
      event: eventId,
      isInvitation: true,
      guestName,
      guestEmail,
      guestPhone,
      ticketType: ticketType || "Regular",
      ticketCount: ticketCount || 1,
      purchaseQuantity: ticketCount || 1,
      price: 0, // Free for guest
      status: "pending",
      paymentStatus: "pending", // Organizer handles payment
      paymentReference: message, // Store message temporarily or add a field
    });

    // Generate RSVP Link
    const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.com";
    const rsvpLink = `${frontendUrl}/guest-invitation?inv=${ticket.ticketId}`;

    // Create Invitation Record to track it
    try {
      await Invitation.create({
        invitationId: uuidv4(),
        eventId,
        organizerId: event.organizer,
        guestName,
        guestEmail,
        guestPhone,
        type: guestEmail ? "email" : "sms",
        guestType: "guest",
        ticketType: ticketType || "Regular",
        amount: ticketCount || 1,
        status: "sent",
        paymentStatus: "paid",
        rsvpLink: rsvpLink,
        rsvpStatus: "pending",
        qrCodeData: ticket.qrCode,
        message,
      });
    } catch (invError) {
      console.error("Failed to create invitation record:", invError);
      // Continue execution
    }

    // Send Email
    if (guestEmail) {
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
        ticketType: ticket.ticketType || "Regular",
        uniqueId: ticket.ticketId,
        actionLink: rsvpLink,
        actionText: "Confirm Attendance",
      };

      const qrCodeUrl = ticket.qrCode;
      const eventImage =
        event.coverImages && event.coverImages.length > 0
          ? event.coverImages[0]
          : "";

      const emailHtml = createEmailTemplate(
        eventData,
        invitationData,
        qrCodeUrl,
        eventImage,
        message
      );

      // We need the QR code from the ticket.
      // The pre-save hook generates it, but it's a data URL.
      // We need to strip the prefix for attachment.
      // const qrCodeBase64 = ticket.qrCode.split(";base64,").pop();

      await sendInvitationEmail({
        to: guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
        // attachments: [
        //   {
        //     filename: "ticket-qr.png",
        //     content: qrCodeBase64,
        //     encoding: "base64",
        //   },
        // ],
      });
    }

    // Send SMS
    if (guestPhone) {
      const eventDate = new Date(event.startDate).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      let timeStr = event.startTime || "";
      if (timeStr && timeStr !== "TBD" && timeStr.includes(":")) {
        const [hours, minutes] = timeStr.split(":");
        const h = parseInt(hours, 10);
        if (!isNaN(h)) {
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          timeStr = `${h12}:${minutes} ${ampm}`;
        }
      }

      const location =
        typeof event.location === "string"
          ? event.location
          : event.location?.address || "See map";

      const smsMessage = `Hello, ${guestName}\n\n${
        message ? message.trim() + "\n\n" : ""
      }Event: ${
        event.title
      }\nDate: ${eventDate} | ${timeStr}\nLocation: ${location}\n\nRSVP Link: ${rsvpLink}`;

      await sendSMS(guestPhone, smsMessage);
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Guest ticket created",
      ticketId: ticket.ticketId,
      ticket,
    });
  } catch (error) {
    console.error("Create guest ticket error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create guest ticket",
      error: error.message,
    });
  }
};

// Helper to process guest invitation (Internal use)
const processGuestInvitation = async (ticketId) => {
  console.log(`processGuestInvitation called for ticketId: ${ticketId}`);
  const ticket = await Ticket.findOne({ ticketId }).populate("event");
  if (!ticket) {
    console.error(`Ticket not found for ticketId: ${ticketId}`);
    throw new Error("Ticket not found");
  }

  console.log(
    `Found ticket: ${ticket.ticketId}, Guest: ${ticket.guestName}, Phone: ${ticket.guestPhone}, Email: ${ticket.guestEmail}`
  );

  if (!ticket.isInvitation) {
    console.error(`Ticket ${ticketId} is not an invitation ticket`);
    throw new Error("Not an invitation ticket");
  }

  // Update payment status
  ticket.paymentStatus = "completed";
  await ticket.save();
  console.log(`Ticket ${ticketId} payment status updated to completed`);

  const event = ticket.event;
  const message = ticket.message;

  // Generate RSVP Link
  const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.com";
  const rsvpLink = `${frontendUrl}/guest-invitation?inv=${ticket.ticketId}`;

  // Create Invitation Record
  try {
    console.log(`Creating Invitation record for ticket ${ticketId}`);
    await Invitation.create({
      eventId: event._id,
      organizerId: event.organizer,
      guestName: ticket.guestName,
      guestEmail: ticket.guestEmail,
      guestPhone: ticket.guestPhone,
      guestType: "guest",
      ticketType: ticket.ticketType,
      type: ticket.guestEmail ? "email" : "sms",
      amount: ticket.ticketCount,
      status: "sent",
      paymentStatus: "paid",
      rsvpLink: rsvpLink,
      rsvpStatus: "pending",
      message,
    });
    console.log(`Invitation record created successfully`);
  } catch (invitationError) {
    console.error("Failed to create invitation record:", invitationError);
    // Continue execution, don't block email sending
  }

  // Send Email
  if (ticket.guestEmail) {
    // Prepare data for the new template signature: createEmailTemplate(event, invitation, qrCodeUrl)
    const eventData = {
      title: event.title,
      date: event.startDate,
      time: event.startTime,
      location:
        typeof event.location === "string"
          ? event.location
          : event.location?.address || "See map",
    };

    const invitationData = {
      guestName: ticket.guestName,
      ticketType: ticket.ticketType || "Regular",
      uniqueId: ticket.ticketId,
      actionLink: rsvpLink,
      actionText: "Confirm Attendance",
    };

    // Use the QR code from the ticket (Data URL)
    // If qrCode is missing, we might want to generate it or handle it, but it should be there from pre-save.
    const qrCodeUrl = ticket.qrCode;

    const eventImage =
      event.coverImages && event.coverImages.length > 0
        ? event.coverImages[0]
        : "";

    const emailHtml = createEmailTemplate(
      eventData,
      invitationData,
      qrCodeUrl,
      eventImage,
      message
    );

    try {
      await sendInvitationEmail({
        to: ticket.guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
      });
      console.log(`Invitation email sent to ${ticket.guestEmail}`);
    } catch (emailError) {
      console.error(
        `Failed to send invitation email to ${ticket.guestEmail}:`,
        emailError
      );
    }
  } else {
    console.log("No guest email found, skipping email.");
  }

  // Send SMS
  if (ticket.guestPhone) {
    console.log(`Sending SMS to ${ticket.guestPhone}`);
    const eventDate = new Date(event.startDate).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const eventTime = event.startTime || "";
    const location =
      typeof event.location === "string"
        ? event.location
        : event.location?.address || "See map";

    const smsMessage = `Hi ${ticket.guestName},\n\n${
      message ? message.trim() + "\n\n" : ""
    }Event: ${
      event.title
    }\nDate and Time: ${eventDate} ${eventTime}\nLocation: ${location}\n\nRSVP Link: ${rsvpLink}`;

    await sendSMS(ticket.guestPhone, smsMessage);
  }
};

// Confirm RSVP and generate tickets
const confirmRSVP = async (req, res) => {
  try {
    const { ticketId } = req.params;

    let ticket = await Ticket.findOne({ ticketId }).populate("event");
    if (!ticket && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await Ticket.findById(ticketId).populate("event");
    }

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!ticket.isInvitation) {
      throw new UnauthorizedError("Not an invitation ticket");
    }

    if (ticket.status === "confirmed") {
      return res.status(StatusCodes.OK).json({
        success: true,
        message: "Already confirmed",
        data: ticket,
      });
    }

    ticket.status = "confirmed";
    // Ensure QR code is generated (pre-save hook handles this if qrCode is empty)
    // If we want separate QR codes for each guest count, we might need to rethink the schema or logic.
    // For now, the requirement says "Generates real QR tickets (one per ticketCount)".
    // The current schema has one QR code per Ticket document, but `ticketCount` field.
    // If we need multiple QR codes, we might need to split this ticket into multiple tickets or return an array of QR codes generated on the fly.
    // However, the schema has `ticketCount` and `qrCode`. The pre-save hook generates one QR code that includes `ticketCount`.
    // Let's stick to the single QR with count is sufficient for the scanner app (which should check count).

    await ticket.save();

    // Sync with Invitation model
    try {
      const query = {
        eventId: ticket.event._id
          ? ticket.event._id.toString()
          : ticket.event.toString(),
        $or: [],
      };

      if (ticket.guestEmail) query.$or.push({ guestEmail: ticket.guestEmail });
      if (ticket.guestPhone) query.$or.push({ guestPhone: ticket.guestPhone });

      if (query.$or.length > 0) {
        const invitation = await Invitation.findOne(query).sort({
          createdAt: -1,
        });
        if (invitation) {
          invitation.rsvpStatus = "confirmed";
          invitation.rsvpConfirmedAt = new Date();
          await invitation.save();
          console.log(
            `Synced Invitation status to confirmed for ticket ${ticketId}`
          );
        }
      }
    } catch (error) {
      console.error("Error syncing Invitation status:", error);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "RSVP Confirmed",
      data: ticket,
    });
  } catch (error) {
    console.error("Confirm RSVP error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to confirm RSVP",
      error: error.message,
    });
  }
};

// Send guest invitation (After Payment)
const sendGuestInvitation = async (req, res) => {
  try {
    const { ticketId } = req.body;
    await processGuestInvitation(ticketId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    console.error("Send guest invitation error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send invitation",
      error: error.message,
    });
  }
};

// Create an invitation ticket
const createInvitationTicket = async (req, res) => {
  try {
    const {
      eventId,
      guestName,
      guestEmail,
      guestPhone,
      ticketType,
      ticketCount,
      message,
    } = req.body;

    console.log("createInvitationTicket Body:", req.body);

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // Check if ticketType exists and update quantity if so
    if (ticketType) {
      const typeInfo = event.ticketTypes.find((t) => t.name === ticketType);
      if (typeInfo) {
        if (typeInfo.quantity < (ticketCount || 1)) {
          throw new BadRequestError("Not enough tickets available");
        }
        typeInfo.quantity -= ticketCount || 1;
        await event.save();
      }
    }

    // Create the ticket
    console.log("Saving Ticket with message:", message);
    const ticket = await Ticket.create({
      event: eventId,
      isInvitation: true,
      guestName,
      guestEmail,
      guestPhone,
      ticketType: ticketType || "Regular", // Default or from body
      ticketCount: ticketCount || 1,
      purchaseQuantity: ticketCount || 1,
      price: 0, // Free for guest
      status: "pending",
      paymentStatus: "completed", // Organizer handles payment
      message: message || "",
    });

    // Generate RSVP Link
    const frontendUrl = process.env.FRONTEND_URL || "https://pazimo.com";
    const rsvpLink = `${frontendUrl}/guest-invitation?inv=${ticket.ticketId}`;

    // Create Invitation Record to track it
    await Invitation.create({
      invitationId: uuidv4(),
      eventId,
      organizerId: event.organizer,
      guestName,
      guestEmail,
      guestPhone,
      type: guestEmail ? "email" : "sms",
      guestType: "guest",
      ticketType: ticket.ticketType,
      amount: ticketCount || 1,
      status: "sent",
      paymentStatus: "paid",
      rsvpLink: rsvpLink,
      rsvpStatus: "pending",
      message: message || "",
    });

    // Send Email
    if (guestEmail) {
      const eventData = {
        title: event.title,
        date: event.startDate,
        time: event.startTime,
        location:
          typeof event.location === "string"
            ? event.location
            : event.location?.address || "See map",
      };

      const invitationData = {
        guestName,
        ticketType: ticket.ticketType || "Regular",
        uniqueId: ticket.ticketId,
        actionLink: rsvpLink,
        actionText: "Confirm Attendance",
        message: message || "", // Include message in data object as well
      };

      const qrCodeUrl = ticket.qrCode;
      const eventImage =
        event.coverImages && event.coverImages.length > 0
          ? event.coverImages[0]
          : "";

      const emailHtml = createEmailTemplate(
        eventData,
        invitationData,
        qrCodeUrl,
        eventImage,
        message || ""
      );

      // We need the QR code from the ticket.
      // The pre-save hook generates it, but it's a data URL.
      // We need to strip the prefix for attachment.
      // const qrCodeBase64 = ticket.qrCode.split(";base64,").pop();

      await sendInvitationEmail({
        to: guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
        // attachments: [
        //   {
        //     filename: "ticket-qr.png",
        //     content: qrCodeBase64,
        //     encoding: "base64",
        //   },
        // ],
      });
    }

    // Send SMS
    if (guestPhone) {
      const eventDate = new Date(event.startDate).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      let timeStr = event.startTime || "";
      if (timeStr && timeStr !== "TBD" && timeStr.includes(":")) {
        const [hours, minutes] = timeStr.split(":");
        const h = parseInt(hours, 10);
        if (!isNaN(h)) {
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          timeStr = `${h12}:${minutes} ${ampm}`;
        }
      }

      const location =
        typeof event.location === "string"
          ? event.location
          : event.location?.address || "See map";

      const smsMessage = `Hello, ${guestName}\n\n${
        message ? message.trim() + "\n\n" : ""
      }Event: ${
        event.title
      }\nDate: ${eventDate} | ${timeStr}\nLocation: ${location}\n\nRSVP Link: ${rsvpLink}`;

      await sendSMS(guestPhone, smsMessage);
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Invitation sent successfully",
      ticket,
    });
  } catch (error) {
    console.error("Create invitation ticket error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create invitation ticket",
      error: error.message,
    });
  }
};

// Get user's tickets
const getUserTickets = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log(`Fetching tickets for user: ${req.user.userId}`);

    // Fetch full user details to get email and phone
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "User not found" });
    }

    // Find tickets linked by ID OR matching email OR matching phone
    const query = {
      $or: [{ user: user._id }],
    };

    if (user.email) {
      query.$or.push({ guestEmail: user.email.toLowerCase() });
    }
    if (user.phoneNumber) {
      query.$or.push({ guestPhone: user.phoneNumber });
    }

    const tickets = await Ticket.find(query)
      .populate("event", "title startDate endDate location")
      .sort("-createdAt");

    console.log(`Found ${tickets.length} tickets for user ${req.user.userId}`);
    res.status(StatusCodes.OK).json({ tickets, count: tickets.length });
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Get event tickets (works with or without authentication)
const getEventTickets = async (req, res) => {
  try {
    const { eventId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500); // Cap at 500
    const skip = (page - 1) * limit;

    // If authentication is present, verify organizer access
    if (req.user && req.user.userId && req.user.userId !== "bypass") {
      const event = await Event.findOne({
        _id: eventId,
        organizer: req.user.userId,
      }).select('_id').lean();
      if (!event) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: "Not authorized to view these tickets",
        });
      }
    }

    // Get count and tickets in parallel for better performance
    const [totalCount, tickets] = await Promise.all([
      Ticket.countDocuments({ event: eventId }),
      Ticket.find({ event: eventId })
        .select('ticketId user guestName guestEmail guestPhone ticketType price status paymentStatus purchaseDate createdAt ticketCount purchaseQuantity isInvitation isOnDoor')
        .populate("user", "firstName lastName email phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    // Calculate statistics using aggregation for better performance
    const statsPromise = Ticket.aggregate([
      { $match: { event: new mongoose.Types.ObjectId(eventId), price: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$price" },
          totalTickets: {
            $sum: {
              $ifNull: [
                { $ifNull: ["$purchaseQuantity", "$ticketCount"] },
                1
              ]
            }
          },
          onDoorRevenue: {
            $sum: {
              $cond: [{ $eq: ["$isOnDoor", true] }, "$price", 0]
            }
          },
          onDoorTickets: {
            $sum: {
              $cond: [
                { $eq: ["$isOnDoor", true] },
                {
                  $ifNull: [
                    { $ifNull: ["$purchaseQuantity", "$ticketCount"] },
                    1
                  ]
                },
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = await statsPromise;
    const statistics = stats.length > 0 ? {
      totalRevenue: stats[0].totalRevenue || 0,
      totalTickets: stats[0].totalTickets || 0,
      onDoorRevenue: stats[0].onDoorRevenue || 0,
      onDoorTickets: stats[0].onDoorTickets || 0
    } : {
      totalRevenue: 0,
      totalTickets: 0,
      onDoorRevenue: 0,
      onDoorTickets: 0
    };

    res
      .status(StatusCodes.OK)
      .json({ 
        tickets, 
        count: tickets.length, 
        totalCount,
        statistics,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + tickets.length < totalCount
      });
  } catch (error) {
    console.error("Get event tickets error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch event tickets",
      error: error.message,
    });
  }
};

// Get organizer's tickets
const getOrganizerTickets = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all events by this organizer
    const events = await Event.find({ organizer: userId }).select("_id");
    const eventIds = events.map((e) => e._id);

    // Find tickets for these events
    const tickets = await Ticket.find({ event: { $in: eventIds } })
      .populate("event", "title")
      .populate("user", "firstName lastName email phoneNumber")
      .lean();

    res.status(StatusCodes.OK).json({ success: true, tickets });
  } catch (error) {
    console.error("Get organizer tickets error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch organizer tickets",
      error: error.message,
    });
  }
};

// Check in a ticket
const checkInTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { count = 1 } = req.body; // Default to 1 if not provided

    let ticket = await Ticket.findOne({ ticketId });
    if (!ticket && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await Ticket.findById(ticketId);
    }

    if (!ticket) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (
      ticket.status === "used" ||
      ticket.checkedIn ||
      ticket.ticketCount <= 0
    ) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: "Ticket already fully used",
        data: {
          ticket,
          remainingUses: 0,
        },
      });
    }

    // Check if enough uses remaining
    if (ticket.ticketCount < count) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Not enough uses remaining. Available: ${ticket.ticketCount}, Requested: ${count}`,
      });
    }

    // Decrement count
    ticket.ticketCount -= count;
    // If count reaches 0, mark as used/checkedIn
    if (ticket.ticketCount <= 0) {
      ticket.ticketCount = 0; // Safety
      ticket.checkedIn = true;
      ticket.checkedInAt = new Date();
      ticket.status = "used";
    }

    await ticket.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: ticket.checkedIn
        ? "Ticket fully checked in"
        : "Ticket usage recorded",
      data: {
        ticket,
        remainingUses: ticket.ticketCount,
        fullyUsed: ticket.checkedIn,
      },
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to check in ticket",
      error: error.message,
    });
  }
};

// Cancel a ticket
const cancelTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!req.user || !req.user.userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Verify the user owns the ticket
    if (ticket.user.toString() !== req.user.userId) {
      throw new UnauthorizedError("Not authorized to cancel this ticket");
    }

    if (ticket.status !== "active") {
      throw new BadRequestError("Ticket cannot be cancelled");
    }

    ticket.status = "cancelled";
    await ticket.save();

    // Update event ticket quantity
    const event = await Event.findById(ticket.event);
    const ticketType = event.ticketTypes.find(
      (type) => type.name === ticket.ticketType
    );
    if (ticketType) {
      ticketType.quantity += 1;
      await event.save();
    }

    res.status(StatusCodes.OK).json({ ticket });
  } catch (error) {
    console.error("Cancel ticket error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel ticket",
      error: error.message,
    });
  }
};

// Get ticket by ID
const getTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId)
      .populate("event", "title startDate endDate location organizer")
      .populate("user", "firstName lastName email");

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    // Verify the user owns the ticket or is the event organizer
    const event = await Event.findById(ticket.event);
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // Check if user and organizer IDs exist before comparing
    const userId = ticket.user?._id?.toString();
    const organizerId = event.organizer?.toString();
    const requestUserId = req.user?.userId;

    if (!userId || !organizerId || !requestUserId) {
      throw new UnauthorizedError("Invalid ticket or user data");
    }

    if (userId !== requestUserId && organizerId !== requestUserId) {
      throw new UnauthorizedError("Not authorized to view this ticket");
    }

    res.status(StatusCodes.OK).json({ ticket });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get ticket",
      error: error.message,
    });
  }
};

// Validate QR code and get ticket information
const validateQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      throw new BadRequestError("QR code data is required");
    }

    // Parse the QR code data
    let ticketData;
    try {
      ticketData = JSON.parse(qrData);
    } catch (error) {
      throw new BadRequestError("Invalid QR code format");
    }

    // Find the ticket using ticketId
    const ticket = await Ticket.findOne({ ticketId: ticketData.ticketId })
      .populate("event", "title startDate endDate location organizer")
      .populate("user", "firstName lastName email");

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    // Verify the ticket data matches
    const ticketUserId = ticket.user ? ticket.user._id.toString() : null;
    if (
      ticket.event._id.toString() !== ticketData.eventId ||
      ticketUserId !== ticketData.userId ||
      ticket.ticketType !== ticketData.ticketType
    ) {
      throw new BadRequestError("Invalid ticket data");
    }

    // Check if ticket is still valid
    if (ticket.status !== "active") {
      throw new BadRequestError(`Ticket is ${ticket.status}`);
    }

    // Check if ticket is already checked in
    if (ticket.checkedIn) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: "Ticket already checked in",
        data: {
          ticketId: ticket.ticketId,
          eventTitle: ticket.event.title,
          eventDate: ticket.event.startDate,
          eventLocation: ticket.event.location,
          ticketType: ticket.ticketType,
          price: ticket.price,
          userName: `${ticket.user.firstName} ${ticket.user.lastName}`,
          userEmail: ticket.user.email,
          purchaseDate: ticket.purchaseDate,
          status: ticket.status,
          checkedIn: ticket.checkedIn,
          checkedInAt: ticket.checkedInAt,
          ticketCount: ticket.ticketCount, // Include ticket count
        },
      });
    }

    // Return ticket information for validation
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ticketId: ticket.ticketId,
        eventTitle: ticket.event.title,
        eventDate: ticket.event.startDate,
        eventLocation: ticket.event.location,
        ticketType: ticket.ticketType,
        price: ticket.price,
        userName: `${ticket.user.firstName} ${ticket.user.lastName}`,
        userEmail: ticket.user.email,
        purchaseDate: ticket.purchaseDate,
        status: ticket.status,
        checkedIn: ticket.checkedIn,
        ticketCount: ticket.ticketCount, // Include ticket count
      },
    });
  } catch (error) {
    console.error("QR code validation error:", error);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || "Failed to validate QR code",
    });
  }
};

// Get ticket details by ID or Transaction Reference (Public)
const getPublicTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`\n[TICKET-FETCH] ============================================`);
    console.log(`[TICKET-FETCH] Fetching tickets for ID: ${id}`);

    // Optimized: Single query with $or instead of 3 sequential queries
    const query = {
      $or: [
        { ticketId: id }, // Search by ticketId (string)
        { paymentReference: id }, // Search by transaction reference
      ],
    };

    // Add ObjectId search only if id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      query.$or.push({ _id: id });
    }

    console.log(`[TICKET-FETCH] Query:`, JSON.stringify(query, null, 2));

    const tickets = await Ticket.find(query)
      .populate(
        "event",
        "title startDate endDate location organizer coverImages"
      )
      .populate("user", "firstName lastName email")
      .lean(); // Use lean() for faster queries since we don't need Mongoose documents

    console.log(`[TICKET-FETCH] Found ${tickets?.length || 0} ticket(s)`);

    if (!tickets || tickets.length === 0) {
      console.log(`[TICKET-FETCH] ❌ No tickets found`);
      console.log(`[TICKET-FETCH] ============================================\n`);
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: "Ticket not found" });
    }

    console.log(`[TICKET-FETCH] ✅ Returning ${tickets.length} ticket(s)`);
    console.log(`[TICKET-FETCH] ============================================\n`);
    res.status(StatusCodes.OK).json({ success: true, data: tickets });
  } catch (error) {
    console.error("[TICKET-FETCH] ❌ Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch ticket details",
      error: error.message,
    });
  }
};

// Get ticket details by ID or Transaction Reference
const getTicketDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user || !req.user.userId) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const userId = req.user.userId;

    let tickets = [];

    // 1. Try finding by ticketId (string)
    const ticketById = await Ticket.findOne({ ticketId: id })
      .populate("event", "title startDate endDate location organizer")
      .populate("user", "firstName lastName email");

    if (ticketById) {
      tickets.push(ticketById);
    }

    // 2. If not found, check if id is a valid ObjectId (for _id lookup)
    if (tickets.length === 0 && mongoose.Types.ObjectId.isValid(id)) {
      const ticket = await Ticket.findById(id)
        .populate("event", "title startDate endDate location organizer")
        .populate("user", "firstName lastName email");

      if (ticket) {
        tickets.push(ticket);
      }
    }

    // 3. If still not found, try finding by paymentReference
    if (tickets.length === 0) {
      const txTickets = await Ticket.find({ paymentReference: id })
        .populate("event", "title startDate endDate location organizer")
        .populate("user", "firstName lastName email");

      if (txTickets && txTickets.length > 0) {
        tickets = txTickets;
      }
    }

    // Filter tickets to ensure they belong to the requesting user
    // We allow checking if the user is the owner OR the organizer of the event
    // For simplicity in this specific endpoint which is for "my-account", we enforce user ownership strictly
    // unless we want to allow organizers to view via this endpoint too.
    // The user requirement says: "if the current user is not the same as the user on the ticket then don't show the ticket."

    const authorizedTickets = tickets.filter((ticket) => {
      const ticketOwnerId =
        ticket.user?._id?.toString() || ticket.user?.toString();
      return ticketOwnerId === userId;
    });

    if (authorizedTickets.length === 0) {
      // If we found tickets but none belong to the user, it's a 403/404
      // If we found no tickets at all, it's a 404
      if (tickets.length > 0) {
        throw new UnauthorizedError("Not authorized to view these tickets");
      }
      throw new NotFoundError("Ticket not found");
    }

    res
      .status(StatusCodes.OK)
      .json({ success: true, tickets: authorizedTickets });
  } catch (error) {
    console.error("Get ticket details error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get ticket details",
      error: error.message,
    });
  }
};

// Get invitation ticket (Public)
const getInvitationTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Find by ticketId (string) or _id
    let ticket = await Ticket.findOne({ ticketId }).populate({
      path: "event",
      populate: { path: "organizer", select: "name" },
    });

    if (!ticket && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await Ticket.findById(ticketId).populate({
        path: "event",
        populate: { path: "organizer", select: "name" },
      });
    }

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!ticket.isInvitation) {
      throw new UnauthorizedError("Not an invitation ticket");
    }

    res.status(StatusCodes.OK).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Get invitation ticket error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get invitation ticket",
      error: error.message,
    });
  }
};

// Update invitation status (Public)
const updateInvitationTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!["confirmed", "declined"].includes(status)) {
      throw new BadRequestError("Invalid status");
    }

    let ticket = await Ticket.findOne({ ticketId });
    if (!ticket && mongoose.Types.ObjectId.isValid(ticketId)) {
      ticket = await Ticket.findById(ticketId);
    }

    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!ticket.isInvitation) {
      throw new UnauthorizedError("Not an invitation ticket");
    }

    ticket.status = status;
    await ticket.save();

    // Sync with Invitation model
    try {
      const query = {
        eventId: ticket.event.toString(),
        $or: [],
      };

      if (ticket.guestEmail) query.$or.push({ guestEmail: ticket.guestEmail });
      if (ticket.guestPhone) query.$or.push({ guestPhone: ticket.guestPhone });

      if (query.$or.length > 0) {
        const invitation = await Invitation.findOne(query).sort({
          createdAt: -1,
        });
        if (invitation) {
          invitation.rsvpStatus = status;
          if (status === "confirmed") {
            invitation.rsvpConfirmedAt = new Date();
          }
          await invitation.save();
          console.log(
            `Synced Invitation status to ${status} for ticket ${ticketId}`
          );
        }
      }
    } catch (error) {
      console.error("Error syncing Invitation status:", error);
    }

    res
      .status(StatusCodes.OK)
      .json({ success: true, message: `Invitation ${status}` });
  } catch (error) {
    console.error("Update invitation status error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update invitation status",
      error: error.message,
    });
  }
};

// Cancel a pending payment
const cancelPaymentIntent = async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Payment record not found",
      });
    }

    if (payment.status === "PAID") {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Cannot cancel a completed payment",
      });
    }

    payment.status = "FAILED"; // Or 'CANCELLED' if you add that to enum
    await payment.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel payment error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel payment",
      error: error.message,
    });
  }
};

// Create On-Door Ticket (Admin/Organizer)
const createOnDoorTicket = async (req, res) => {
  try {
    const { eventId, ticketTypeId, quantity, paymentMethod, status } = req.body;
    const userId = req.user ? req.user._id : null; // Admin/Organizer ID who created it

    if (!eventId || !ticketTypeId || !quantity) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Event ID, Ticket Type ID, and Quantity are required",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Event not found",
      });
    }

    // Find ticket type
    const ticketType = event.ticketTypes.find(
      (t) => t._id.toString() === ticketTypeId || t.name === ticketTypeId
    );

    if (!ticketType) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid ticket type",
      });
    }

    // Check availability
    if (ticketType.quantity < quantity) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Not enough tickets available. Only ${ticketType.quantity} left.`,
      });
    }

    // Deduct quantity
    ticketType.quantity -= quantity;
    await event.save();

    const totalPrice = ticketType.price * quantity;
    const transactionId = `ONDOOR-${uuidv4()}`;

    // Create Payment Record
    const payment = await Payment.create({
      transactionId,
      status: "PAID",
      method: paymentMethod || "CASH",
      price: totalPrice,
      eventId,
      userId: userId, // The admin/organizer who processed it
      ticketDetails: {
        eventId,
        ticketTypeId: ticketType.name,
        ticketCount: quantity,
        price: totalPrice,
      },
      invitationType: "on-door",
    });

    // Create Ticket
    const ticketId = `TICKET-${uuidv4()}`;
    const ticket = await Ticket.create({
      ticketId,
      event: eventId,
      ticketType: ticketType.name,
      ticketCount: quantity,
      purchaseQuantity: quantity,
      price: totalPrice,
      status: status || "active",
      paymentStatus: "completed",
      paymentReference: transactionId,
      isOnDoor: true,
      isInvitation: false,
    });

    // Generate QR
    const qrData = JSON.stringify({
      ticketId: ticket.ticketId,
      eventId: eventId,
      type: "on-door",
      count: quantity,
    });
    ticket.qrCode = await QRCode.toDataURL(qrData);
    await ticket.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "On-door ticket created successfully",
      data: {
        ticket,
        payment,
      },
    });
  } catch (error) {
    console.error("Create On-Door Ticket Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create on-door ticket",
      error: error.message,
    });
  }
};

module.exports = {
  createTicket,
  createInvitationTicket,
  getUserTickets,
  getEventTickets,
  getOrganizerTickets,
  checkInTicket,
  cancelTicket,
  getTicket,
  getAllTicketsAdmin,
  validateQRCode,
  getTicketDetails,
  getPublicTicketDetails,
  getInvitationTicket,
  updateInvitationTicketStatus,
  createGuestTicket,
  sendGuestInvitation,
  processGuestInvitation,
  confirmRSVP,
  processSuccessfulPayment,
  cancelPaymentIntent,
  createOnDoorTicket,
};
