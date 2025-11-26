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
        "http://localhost:3000/api/payment/santimpay/webhook", // Webhook URL
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
      payment.status = "PAID";
      payment.santimPayResponse = santimStatus;
      await payment.save();

      // Trigger Success Logic
      await handlePaymentSuccess(payment);

      return res.status(200).json({ success: true, status: "PAID" });
    } else if (status === "FAILED") {
      payment.status = "FAILED";
      await payment.save();
      return res.status(200).json({ success: true, status: "FAILED" });
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
      if (payment.status !== "PAID") {
        payment.status = "PAID";
        payment.santimPayResponse = payload;
        await payment.save();
        await handlePaymentSuccess(payment);
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

// Core Success Logic
const handlePaymentSuccess = async (payment) => {
  try {
    const event = await Event.findById(payment.eventId);
    if (!event) throw new Error("Event not found");

    const { invitationType, ticketDetails } = payment;
    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

    if (invitationType === "guest") {
      // ... existing guest logic ...
      // 1. Create Ticket
      const ticketId = "TICKET-" + uuidv4();

      // Generate QR Code for Ticket
      const qrPayload = {
        ticketId,
        eventId: payment.eventId,
        type: "guest_ticket",
      };
      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload));

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
        qrCode: qrCodeBase64,
      });

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
          attachments: [
            {
              filename: "ticket-qr.png",
              content: qrCodeBase64.split(";base64,").pop(),
              encoding: "base64",
            },
          ],
        });
      } else if (payment.method === "phone") {
        // SMS
        let phone = payment.contact.replace(/\s+/g, "").replace("+", "");
        if (phone.startsWith("0")) phone = "251" + phone.substring(1);
        else if (!phone.startsWith("251")) phone = "251" + phone;

        const smsMessage = `Hi ${payment.guestName}, ${message}You have a ticket for ${event.title}. Ticket ID: ${ticketId}. View here: ${rsvpLink}`;

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

        const smsMessage = `Hi ${payment.guestName}, ${message}You are invited to ${event.title}. Get your ticket here: ${eventLink}`;

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
};
