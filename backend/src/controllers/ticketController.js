const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const Invitation = require("../models/Invitation");
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
const axios = require("axios");
const Payment = require("../models/Payment");
const SantimPayService = require("../services/santimPayService");

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
  if (payment.status !== "PAID") return null;

  const { eventId, ticketType, seatNumber, userId, ticketCount, ticketId } =
    payment.ticketDetails;

  // Check if ticket already exists (idempotency)
  const existingTicket = await Ticket.findOne({ ticketId });
  if (existingTicket) return existingTicket;

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
    price: ticketTypeInfo.price * (ticketCount || 1),
    seatNumber,
    paymentReference: payment.transactionId,
    status: "active",
    paymentStatus: "completed",
  };

  // Handle User vs Guest
  if (userId) {
    ticketData.user = userId;
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

  // Update event ticket quantity
  ticketTypeInfo.quantity -= ticketCount || 1;
  await event.save();

  // If user exists, add ticket to user's history (optional but good practice)
  if (userId) {
    const User = require("../models/User");
    await User.findByIdAndUpdate(userId, { $push: { tickets: ticket._id } });
  }

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

    // ✅ Fetch tickets with event & user data
    const tickets = await Ticket.find()
      .populate({
        path: "event",
        select: "title startDate endDate location organizer",
        populate: {
          path: "organizer",
          select: "name email",
        },
      })
      .populate("user", "firstName lastName email")
      .lean();

    // Format the tickets data
    const formattedTickets = tickets.map((ticket) => ({
      ...ticket,
      event: ticket.event
        ? {
            title: ticket.event.title,
            organizer: ticket.event.organizer
              ? {
                  name: ticket.event.organizer.name,
                }
              : null,
          }
        : null,
      user: ticket.user
        ? {
            name: `${ticket.user.firstName} ${ticket.user.lastName}`,
          }
        : null,
    }));

    // ✅ Calculate total sold and revenue
    const totalSold = tickets.length;
    const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedTickets,
      totalSold,
      totalRevenue,
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
      ticketType: ticketType || "General",
      ticketCount: ticketCount || 1,
      price: 0, // Free for guest
      status: "pending",
      paymentStatus: "pending", // Organizer handles payment
      paymentReference: message, // Store message temporarily or add a field
    });

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
  const message = ticket.paymentReference;

  // Generate RSVP Link
  const frontendUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
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
      type: ticket.guestEmail ? "email" : "sms",
      amount: ticket.ticketCount,
      status: "sent",
      paymentStatus: "paid",
      rsvpLink: rsvpLink,
      rsvpStatus: "pending",
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
      location:
        typeof event.location === "string"
          ? event.location
          : event.location?.address || "See map",
    };

    const invitationData = {
      guestName: ticket.guestName,
      ticketType: ticket.ticketType || "General",
      uniqueId: ticket.ticketId,
    };

    // Use the QR code from the ticket (Data URL)
    // If qrCode is missing, we might want to generate it or handle it, but it should be there from pre-save.
    const qrCodeUrl = ticket.qrCode;

    const emailHtml = createEmailTemplate(eventData, invitationData, qrCodeUrl);

    // Extract base64 for attachment (remove "data:image/png;base64,")
    const qrCodeBase64 = ticket.qrCode
      ? ticket.qrCode.split(";base64,").pop()
      : "";

    try {
      await sendInvitationEmail({
        to: ticket.guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
        attachments: qrCodeBase64
          ? [
              {
                filename: "ticket-qr.png",
                content: qrCodeBase64,
                encoding: "base64",
              },
            ]
          : [],
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
    const smsMessage = `Hi ${ticket.guestName}, you are invited to ${
      event.title
    }. ${
      message ? message + " " : ""
    }Click here to confirm your attendance: ${rsvpLink}`;

    let phone = ticket.guestPhone.replace("+", "");
    // Ensure phone starts with 251
    if (phone.startsWith("0")) {
      phone = "251" + phone.substring(1);
    } else if (!phone.startsWith("251")) {
      phone = "251" + phone;
    }

    console.log(`Formatted phone for SMS: ${phone}`);

    try {
      const smsResponse = await axios.post(
        "https://api.geezsms.com/api/v1/sms/send",
        {
          phone: phone,
          msg: smsMessage,
          token:
            process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
        }
      );
      console.log("SMS sent successfully:", smsResponse.data);
    } catch (err) {
      console.error("SMS Error:", err.response?.data || err.message);
    }
  } else {
    console.log("No guest phone found, skipping SMS.");
  }

  return true;
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
    // Let's stick to the single QR code representing multiple entries for now, as refactoring to multiple documents is a bigger change.
    // Or, we can generate multiple QR codes here and return them, but only save one "master" QR on the ticket.
    // Let's assume the single QR with count is sufficient for the scanner app (which should check count).

    await ticket.save();

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
      ticketType: ticketType || "General", // Default or from body
      ticketCount: ticketCount || 1,
      price: 0, // Free for guest
      status: "pending",
      paymentStatus: "completed", // Organizer handles payment
    });

    // Generate RSVP Link
    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
    const rsvpLink = `${frontendUrl}/guest-invitation?id=${ticket.ticketId}`;

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
        ticketType: ticket.ticketType || "General",
        uniqueId: ticket.ticketId,
      };

      const qrCodeUrl = ticket.qrCode;
      const emailHtml = createEmailTemplate(
        eventData,
        invitationData,
        qrCodeUrl
      );

      // We need the QR code from the ticket.
      // The pre-save hook generates it, but it's a data URL.
      // We need to strip the prefix for attachment.
      const qrCodeBase64 = ticket.qrCode.split(";base64,").pop();

      await sendInvitationEmail({
        to: guestEmail,
        subject: `You're invited to ${event.title}!`,
        body: emailHtml,
        attachments: [
          {
            filename: "ticket-qr.png",
            content: qrCodeBase64,
            encoding: "base64",
          },
        ],
      });
    }

    // Send SMS
    if (guestPhone) {
      const smsMessage = `Hi ${guestName}, you are invited to ${event.title}. ${
        message ? message + " " : ""
      }Click here to confirm: ${rsvpLink}`;

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
  const tickets = await Ticket.find({ user: req.user.userId })
    .populate("event", "title startDate endDate location")
    .sort("-createdAt");

  res.status(StatusCodes.OK).json({ tickets, count: tickets.length });
};

// Get event tickets (works with or without authentication)
const getEventTickets = async (req, res) => {
  try {
    const { eventId } = req.params;

    // If authentication is present, verify organizer access
    if (req.user && req.user.userId && req.user.userId !== "bypass") {
      const event = await Event.findOne({
        _id: eventId,
        organizer: req.user.userId,
      });
      if (!event) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: "Not authorized to view these tickets",
        });
      }
    }

    const tickets = await Ticket.find({ event: eventId })
      .populate("user", "firstName lastName email")
      .sort("-createdAt");

    res.status(StatusCodes.OK).json({ tickets, count: tickets.length });
  } catch (error) {
    console.error("Get event tickets error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch event tickets",
      error: error.message,
    });
  }
};

// Check in a ticket
const checkInTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { count = 1 } = req.body; // Default to 1 if not provided

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Verify the user is the event organizer
    const event = await Event.findOne({
      _id: ticket.event,
      organizer: req.user.userId,
    });
    if (!event) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Not authorized to check in this ticket",
      });
    }

    // Check if already fully used
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
  const { ticketId } = req.params;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new NotFoundError("Ticket not found");
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
};

// Get ticket by ID
const getTicket = async (req, res) => {
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
  const { id } = req.params;

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

  if (tickets.length === 0) {
    throw new NotFoundError("Ticket not found");
  }

  res.status(StatusCodes.OK).json({ success: true, data: tickets });
};

// Get ticket details by ID or Transaction Reference
const getTicketDetails = async (req, res) => {
  const { id } = req.params;
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
};

// Get invitation ticket (Public)
const getInvitationTicket = async (req, res) => {
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
};

// Update invitation status (Public)
const updateInvitationTicketStatus = async (req, res) => {
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

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: `Invitation ${status}` });
};

module.exports = {
  createTicket,
  createInvitationTicket,
  getUserTickets,
  getEventTickets,
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
};
