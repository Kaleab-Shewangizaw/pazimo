const Payment = require("../models/Payment");
const Ticket = require("../models/Ticket");
const Invitation = require("../models/Invitation");
const Event = require("../models/Event");
const SantimPayService = require("../services/santimPayService");
const {
  sendInvitationEmail,
  createEmailTemplate,
} = require("./invitationEmailController");
const { processPaidInvitations } = require("./invitationController");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

// Initiate Direct Payment for Invitation
const initiateInvitationPayment = async (req, res) => {
  try {
    const {
      amount,
      paymentReason,
      phoneNumber,
      invitationData,
      paymentMethod: reqPaymentMethod,
    } = req.body;
    const userId = req.user ? req.user._id : null;

    // Generate a unique transaction ID
    const transactionId = uuidv4();

    // Determine payment method
    const paymentMethod =
      reqPaymentMethod || (phoneNumber ? "Telebirr" : "Unknown");

    // Initiate Direct Payment via SantimPay
    // Note: SantimPay Direct Payment is async. We get a success response if initiation works.
    await SantimPayService.directPayment(
      transactionId,
      amount,
      paymentReason,
      process.env.SANTIM_PAY_NOTIFY_URL ||
        `${
          process.env.BACKEND_URL || "https://pazimoapp.testserveret.com"
        }/api/payment/santimpay/webhook`, // Webhook URL
      phoneNumber,
      paymentMethod
    );

    // Save Payment Record
    const payment = await Payment.create({
      transactionId,
      status: "PENDING",
      guestName: invitationData.customerName,
      contact: invitationData.contact,
      method: invitationData.contactType, // "email" or "phone"
      invitationType: invitationData.guestType || invitationData.type, // "guest" or "paid" or "bulk_invitation_fee"
      message: invitationData.message,
      price: amount,
      eventId:
        invitationData.eventId ||
        (invitationData.selectedEvent
          ? invitationData.selectedEvent.id || invitationData.selectedEvent._id
          : null),
      userId,
      ticketDetails: {
        qrCodeCount: invitationData.qrCodeCount,
        ...invitationData,
      },
    });

    res.status(200).json({
      success: true,
      message: "Payment initiated",
      transactionId,
      payment,
    });
  } catch (error) {
    console.error("Initiate Invitation Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message,
    });
  }
};

// Check Payment Status (Polling)
const checkInvitationPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "PAID") {
      return res.status(200).json({ success: true, status: "PAID" });
    }

    // Check with SantimPay
    const santimStatus = await SantimPayService.checkTransactionStatus(
      transactionId
    );

    // Update status based on SantimPay response
    // Note: Adjust based on actual SantimPay response structure
    const status = santimStatus.status || santimStatus.paymentStatus;

    if (status === "COMPLETED" || status === "SUCCESS") {
      // Atomic update to prevent race condition
      const updatedPayment = await Payment.findOneAndUpdate(
        { transactionId, status: { $ne: "PAID" } },
        { status: "PAID", santimPayResponse: santimStatus },
        { new: true }
      );

      if (updatedPayment) {
        // Trigger Success Logic only if we updated the status
        await handlePaymentSuccess(updatedPayment);
      }

      return res.status(200).json({ success: true, status: "PAID" });
    } else if (status === "FAILED") {
      payment.status = "FAILED";
      await payment.save();
      return res.status(200).json({ success: true, status: "FAILED" });
    } else if (status === "CANCELLED" || status === "EXPIRED") {
      payment.status = "FAILED";
      await payment.save();
      return res.status(200).json({ success: true, status: "CANCELLED" });
    }

    return res.status(200).json({ success: true, status: "PENDING" });
  } catch (error) {
    console.error("Check Invitation Payment Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to check status" });
  }
};

// Webhook Handler (Optional, if using live webhooks)
const invitationWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const transactionId = payload.id || payload.transactionId;

    // Validate signature (Optional but recommended)
    // const signature = req.get("Signed-Token");
    // if (!SantimPayService.verifyWebhook(signature)) {
    //   return res.status(400).send("Invalid signature");
    // }

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res.status(404).send("Payment record not found");
    }

    if (payload.status === "COMPLETED" || payload.status === "SUCCESS") {
      const updatedPayment = await Payment.findOneAndUpdate(
        { transactionId, status: { $ne: "PAID" } },
        { status: "PAID", santimPayResponse: payload },
        { new: true }
      );

      if (updatedPayment) {
        await handlePaymentSuccess(updatedPayment);
      }
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).send("Webhook Error");
  }
};

// Cancel Payment
const cancelInvitationPayment = async (req, res) => {
  try {
    const { transactionId } = req.body;

    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    if (payment.status === "PAID") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot cancel a paid transaction" });
    }

    payment.status = "CANCELLED";
    await payment.save();

    return res
      .status(200)
      .json({ success: true, message: "Payment cancelled successfully" });
  } catch (error) {
    console.error("Cancel Invitation Payment Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to cancel payment" });
  }
};

// Core Success Logic
const handlePaymentSuccess = async (payment) => {
  try {
    const event = await Event.findById(payment.eventId);
    if (!event) throw new Error("Event not found");

    const { invitationType, ticketDetails } = payment;
    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "https://pazimo.vercel.app";

    if (invitationType === "guest") {
      // Check if already processed
      const existingTicket = await Ticket.findOne({
        paymentReference: payment.transactionId,
      });
      if (existingTicket) {
        console.log(
          `Payment ${payment.transactionId} already processed (Ticket exists).`
        );
        return;
      }

      // ... existing guest logic ...
      // 1. Create Ticket
      const ticketId = "TICKET-" + uuidv4();

      // Let Ticket model generate the QR code (includes guest_name and type: guest)
      const ticket = await Ticket.create({
        ticketId,
        event: payment.eventId,
        isInvitation: true,
        guestName: payment.guestName,
        guestEmail: payment.method === "email" ? payment.contact : undefined,
        guestPhone: payment.method === "phone" ? payment.contact : undefined,
        ticketType: "Guest Ticket",
        ticketCount: ticketDetails.qrCodeCount || 1,
        price: 0,
        status: "active",
        paymentStatus: "completed",
        paymentReference: payment.transactionId,
      });

      const qrCodeBase64 = ticket.qrCode;

      // 2. Create Invitation
      const invitationId = uuidv4();
      const rsvpLink = `${frontendUrl}/guest-invitation?inv=${ticketId}`; // Using ticketId for RSVP/Entry

      await Invitation.create({
        invitationId,
        eventId: payment.eventId,
        organizerId: payment.userId,
        guestName: payment.guestName,
        guestEmail: payment.method === "email" ? payment.contact : undefined,
        guestPhone: payment.method === "phone" ? payment.contact : undefined,
        type: payment.method === "email" ? "email" : "sms",
        guestType: "guest",
        amount: ticketDetails.qrCodeCount || 1,
        status: "sent",
        paymentStatus: "paid",
        qrCodeData: qrCodeBase64,
        rsvpLink,
        paymentReference: payment.transactionId,
      });

      // 3. Send SMS or Email
      const message = payment.message ? `${payment.message}\n\n` : "";

      if (payment.method === "email") {
        const eventData = {
          title: event.title,
          date: event.startDate,
          location:
            typeof event.location === "string"
              ? event.location
              : event.location?.address || "See map",
        };
        const invitationData = {
          guestName: payment.guestName,
          ticketType: "Guest Ticket",
          uniqueId: ticketId,
        };

        const emailHtml = createEmailTemplate(
          eventData,
          invitationData,
          qrCodeBase64
        );

        await sendInvitationEmail({
          to: payment.contact,
          subject: `Your Ticket for ${event.title}`,
          body: emailHtml,
        });
      } else if (payment.method === "phone") {
        // SMS
        let phone = payment.contact.replace(/\s+/g, "").replace("+", "");
        if (phone.startsWith("0")) phone = "251" + phone.substring(1);
        else if (!phone.startsWith("251")) phone = "251" + phone;

        // Format Date
        const eventDateObj = new Date(event.startDate);
        const dateStr = eventDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        // Format Time
        let timeStr = event.startTime || "";
        if (timeStr && timeStr !== "TBD" && timeStr.includes(":")) {
          const [hours, minutes] = timeStr.split(":");
          const h = parseInt(hours, 10);
          if (!isNaN(h)) {
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            timeStr = `${h12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
          }
        }
        const dateTimeStr = `${dateStr} | ${timeStr}`;

        const smsMessage = `Hi ${payment.guestName}${
          payment.message ? "\n\n" + payment.message.trim() : ""
        }\n\nEvent: ${event.title}\nTime: ${dateTimeStr}\nLocation: ${
          typeof event.location === "string"
            ? event.location
            : event.location?.address || "See map"
        }\n\nRSVP Link: ${rsvpLink}`;

        console.log(`Sending SMS to ${phone}: ${smsMessage}`);

        await axios
          .post("https://api.geezsms.com/api/v1/sms/send", {
            phone: phone,
            msg: smsMessage,
            token:
              process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
          })
          .then((response) => {
            console.log("SMS sent successfully:", response.data);
          })
          .catch((err) => {
            console.error(
              "SMS Error:",
              err.response ? err.response.data : err.message
            );
          });
      }
    } else if (invitationType === "bulk_invitation_fee") {
      // Bulk Invitation Logic
      const { pendingInvitationIds } = ticketDetails;
      if (pendingInvitationIds && Array.isArray(pendingInvitationIds)) {
        console.log(
          `Processing ${pendingInvitationIds.length} bulk invitations for transaction ${payment.transactionId}`
        );
        await processPaidInvitations(
          pendingInvitationIds,
          payment.transactionId
        );
      }
    } else if (invitationType === "paid") {
      // Check if already processed
      const existingInvitation = await Invitation.findOne({
        paymentReference: payment.transactionId,
      });
      if (existingInvitation) {
        console.log(
          `Payment ${payment.transactionId} already processed (Invitation exists).`
        );
        return;
      }

      // Paid Attendee - Just send link to event
      const eventLink = `${frontendUrl}/event_detail?id=${payment.eventId}`;
      const message = payment.message ? `${payment.message}\n\n` : "";

      if (payment.method === "email") {
        const emailBody = `
          <h1>You're Invited!</h1>
          <p>Hi ${payment.guestName},</p>
          <p>${message}You are invited to <strong>${event.title}</strong>.</p>
          <p>Please click the link below to view event details and purchase your ticket:</p>
          <a href="${eventLink}">${eventLink}</a>
        `;

        await sendInvitationEmail({
          to: payment.contact,
          subject: `Invitation to ${event.title}`,
          body: emailBody,
        });
      } else if (payment.method === "phone") {
        // SMS
        let phone = payment.contact.replace(/\s+/g, "").replace("+", "");
        if (phone.startsWith("0")) phone = "251" + phone.substring(1);
        else if (!phone.startsWith("251")) phone = "251" + phone;

        // Format Date
        const eventDateObj = new Date(event.startDate);
        const dateStr = eventDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        // Format Time
        let timeStr = event.startTime || "";
        if (timeStr && timeStr !== "TBD" && timeStr.includes(":")) {
          const [hours, minutes] = timeStr.split(":");
          const h = parseInt(hours, 10);
          if (!isNaN(h)) {
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            timeStr = `${h12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
          }
        }
        const dateTimeStr = `${dateStr} | ${timeStr}`;

        const smsMessage = `Hi ${payment.guestName}${
          payment.message ? "\n\n" + payment.message.trim() : ""
        }\n\nEvent: ${event.title}\nTime: ${dateTimeStr}\nLocation: ${
          typeof event.location === "string"
            ? event.location
            : event.location?.address || "See map"
        }\n\nRSVP Link: ${eventLink}`;

        console.log(`Sending SMS to ${phone}: ${smsMessage}`);

        await axios
          .post("https://api.geezsms.com/api/v1/sms/send", {
            phone: phone,
            msg: smsMessage,
            token:
              process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw",
          })
          .then((response) => {
            console.log("SMS sent successfully:", response.data);
          })
          .catch((err) => {
            console.error(
              "SMS Error:",
              err.response ? err.response.data : err.message
            );
          });
      }

      // Also create an Invitation record for tracking (optional but good practice)
      await Invitation.create({
        invitationId: uuidv4(),
        eventId: payment.eventId,
        organizerId: payment.userId,
        guestName: payment.guestName,
        guestEmail: payment.method === "email" ? payment.contact : undefined,
        guestPhone: payment.method === "phone" ? payment.contact : undefined,
        type: payment.method === "email" ? "email" : "sms",
        guestType: "paid",
        amount: 0,
        status: "sent",
        paymentStatus: "paid",
        paymentReference: payment.transactionId,
      });
    }
  } catch (error) {
    console.error("Handle Payment Success Error:", error);
    // Don't throw, just log. We don't want to crash the webhook/polling response.
  }
};

module.exports = {
  initiateInvitationPayment,
  checkInvitationPaymentStatus,
  invitationWebhook,
  cancelInvitationPayment,
};
