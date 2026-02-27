const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { processSuccessfulPayment } = require("./ticketController");

const chapaWebhook = async (req, res) => {
  try {
    // Verify webhook signature only when secret is configured
    const signature = req.headers["chapa-signature"];
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;

    if (webhookSecret) {
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(payload)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.log("Invalid webhook signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn(
        "CHAPA_WEBHOOK_SECRET is not configured. Skipping signature validation."
      );
    }

    const { event, data } = req.body;
    const txRef = data?.tx_ref;
    const normalizedEvent = String(event || "").toLowerCase();
    const normalizedStatus = String(data?.status || "").toLowerCase();

    const isSuccessEvent =
      normalizedEvent === "charge.success" ||
      normalizedStatus === "success" ||
      normalizedStatus === "completed" ||
      normalizedStatus === "paid";

    const isFailureEvent =
      normalizedStatus === "failed" ||
      normalizedStatus === "cancelled" ||
      normalizedStatus === "canceled";

    if (!txRef) {
      return res.status(400).json({ error: "Missing tx_ref in webhook payload" });
    }

    // Primary flow: Fulfill Payment records (ticket purchase flow)
    const payment = await Payment.findOne({ transactionId: txRef });

    if (payment) {
      console.log("Chapa webhook received for payment:", {
        tx_ref: txRef,
        event,
        status: data?.status,
        currentPaymentStatus: payment.status,
      });

      if (isSuccessEvent) {
        if (payment.status !== "PAID") {
          payment.status = "PAID";
          payment.santimPayResponse = data;
          await payment.save();

          const createdTicket = await processSuccessfulPayment(payment);

          return res.status(200).json({
            message: "Webhook processed and payment fulfilled",
            transactionId: txRef,
            ticketId: createdTicket?.ticketId || null,
          });
        }

        return res.status(200).json({
          message: "Webhook already fulfilled",
          transactionId: txRef,
        });
      }

      if (isFailureEvent) {
        payment.status =
          normalizedStatus === "cancelled" || normalizedStatus === "canceled"
            ? "CANCELLED"
            : "FAILED";
        payment.santimPayResponse = data;
        await payment.save();

        return res.status(200).json({
          message: "Webhook processed with failed/cancelled status",
          transactionId: txRef,
          paymentStatus: payment.status,
        });
      }

      return res.status(200).json({
        message: "Webhook received with unhandled status",
        transactionId: txRef,
      });
    }

    // Legacy fallback flow: pre-created pending tickets
    if (isSuccessEvent) {
      const { amount } = data;

      console.log("Legacy ticket webhook received:", { tx_ref: txRef, amount });

      // Find pending ticket purchase by reference
      const tickets = await Ticket.find({
        paymentReference: txRef,
        status: "pending",
      }).populate("event user");

      if (tickets.length === 0) {
        console.log("No pending tickets or payment found for reference:", txRef);
        return res.status(200).json({ message: "No matching payment or pending tickets" });
      }

      // Verify payment amount matches ticket total
      const totalAmount = tickets.reduce(
        (sum, ticket) => sum + ticket.price,
        0
      );
      if (Math.abs(totalAmount - amount) > 0.01) {
        console.log("Amount mismatch:", {
          expected: totalAmount,
          received: amount,
        });
        return res.status(400).json({ error: "Amount mismatch" });
      }

      // Update tickets to active status
      await Ticket.updateMany(
        { paymentReference: txRef },
        {
          status: "active",
          paymentStatus: "completed",
          paymentDate: new Date(),
        }
      );

      console.log(`Updated ${tickets.length} tickets to active status`);

      // Send notification (optional)
      // You can add email/SMS notification here

      res.status(200).json({ message: "Webhook processed successfully" });
    } else if (isFailureEvent) {
      await Ticket.updateMany(
        { paymentReference: txRef, status: "pending" },
        {
          paymentStatus: "failed",
        }
      );
      res.status(200).json({ message: "Failed/cancelled webhook processed" });
    } else {
      console.log("Unhandled webhook event:", event);
      res.status(200).json({ message: "Event not handled" });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  chapaWebhook,
};
