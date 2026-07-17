const crypto = require("crypto");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { processSuccessfulPayment } = require("./ticketController");
const ChapaService = require("../services/chapaService");
const ChapaGiftCardService = require("../services/chapaGiftCardService");
const { flagTamperAttempt } = require("../utils/fraudGuard");
const { amountsMatch } = require("../utils/pricing");

const CHAPA_PAYMENT_GRACE_MS = 2 * 60 * 1000;

const getPaymentAgeMs = (payment) => {
  const createdAt = payment?.createdAt ? new Date(payment.createdAt).getTime() : 0;
  if (!createdAt) {
    return Number.POSITIVE_INFINITY;
  }

  return Date.now() - createdAt;
};

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
          // Never fulfill off the webhook body alone — anyone who can guess a
          // tx_ref could POST a fake "success" payload here. Confirm directly
          // with Chapa's own verify API (the authoritative source for both
          // status and the amount actually paid) before creating any ticket.
          let verifyResult;
          try {
            verifyResult = await ChapaService.verify(txRef);
          } catch (err) {
            console.error("Chapa verify failed during webhook fulfillment:", err.message);
            return res.status(502).json({ error: "Could not verify payment with Chapa" });
          }

          const verifiedStatus = String(
            verifyResult?.data?.status || verifyResult?.status || ""
          ).toLowerCase();
          const verifiedAmount = verifyResult?.data?.amount;

          if (verifiedStatus !== "success" || !amountsMatch(verifiedAmount, payment.price)) {
            await flagTamperAttempt({
              phone: payment.paymentPhone || payment.contact,
              userId: payment.userId,
              reason: "Chapa webhook claimed success but verify() disagreed",
              meta: {
                transactionId: txRef,
                expectedAmount: payment.price,
                verifiedAmount,
                verifiedStatus,
              },
            });
            return res.status(400).json({ error: "Payment could not be verified with Chapa" });
          }

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
        const isWithinGracePeriod = getPaymentAgeMs(payment) < CHAPA_PAYMENT_GRACE_MS;

        if (isWithinGracePeriod && payment.status === "PENDING") {
          console.log(
            `Chapa webhook reported ${normalizedStatus} for ${txRef}, but the payment is still within the ${Math.round(
              CHAPA_PAYMENT_GRACE_MS / 1000
            )}s grace period. Leaving it pending so the user can still complete the mobile confirmation.`
          );

          return res.status(200).json({
            message: "Webhook received while payment is still in grace period",
            transactionId: txRef,
            paymentStatus: payment.status,
          });
        }

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
      console.log("Legacy ticket webhook received:", { tx_ref: txRef });

      // Find pending ticket purchase by reference
      const tickets = await Ticket.find({
        paymentReference: txRef,
        status: "pending",
      }).populate("event user");

      if (tickets.length === 0) {
        console.log("No pending tickets or payment found for reference:", txRef);
        return res.status(200).json({ message: "No matching payment or pending tickets" });
      }

      // Don't trust the webhook body's amount — confirm directly with Chapa.
      let verifyResult;
      try {
        verifyResult = await ChapaService.verify(txRef);
      } catch (err) {
        console.error("Chapa verify failed during legacy webhook fulfillment:", err.message);
        return res.status(502).json({ error: "Could not verify payment with Chapa" });
      }

      const verifiedStatus = String(
        verifyResult?.data?.status || verifyResult?.status || ""
      ).toLowerCase();
      const verifiedAmount = verifyResult?.data?.amount;

      // Verify payment amount matches ticket total
      const totalAmount = tickets.reduce(
        (sum, ticket) => sum + ticket.price,
        0
      );
      if (verifiedStatus !== "success" || !amountsMatch(verifiedAmount, totalAmount)) {
        console.log("Amount/status mismatch:", {
          expected: totalAmount,
          verifiedAmount,
          verifiedStatus,
        });
        await flagTamperAttempt({
          phone: tickets[0]?.guestPhone || tickets[0]?.user?.phoneNumber,
          userId: tickets[0]?.user?._id,
          reason: "Chapa legacy webhook claimed success but verify() disagreed",
          meta: { transactionId: txRef, expectedAmount: totalAmount, verifiedAmount, verifiedStatus },
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

// Chapa Link (gift card) webhook — Link is a separate product from the main
// Chapa checkout API, with its own webhook URL that must be registered
// through Chapa support/account manager (not the merchant dashboard). Fires
// payment.success / payment.failed / payment.cancelled for gift-card top-ups
// initiated from ticket checkout when gift-card routing is enabled.
const chapaGiftCardWebhook = async (req, res) => {
  try {
    const signature = req.headers["link-app-signature"];
    const webhookSecret = process.env.CHAPA_LINK_WEBHOOK_SECRET;

    if (webhookSecret) {
      // Per Chapa Link docs, the signature is HMAC-SHA256 of the secret,
      // signed with itself — not the request body.
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(webhookSecret)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.log("[GIFTCARD-WEBHOOK] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      console.warn(
        "[GIFTCARD-WEBHOOK] CHAPA_LINK_WEBHOOK_SECRET is not configured. Skipping signature validation."
      );
    }

    const { event, merchant_reference, status, link_app_reference } = req.body || {};
    const normalizedEvent = String(event || "").toLowerCase();
    const normalizedStatus = String(status || "").toLowerCase();
    const txRef = merchant_reference;

    if (!txRef) {
      return res.status(400).json({ error: "Missing merchant_reference in webhook payload" });
    }

    const payment = await Payment.findOne({
      transactionId: txRef,
      provider: "chapa_giftcard",
    });

    if (!payment) {
      console.log(`[GIFTCARD-WEBHOOK] No matching gift-card payment for ${txRef}`);
      return res.status(200).json({ message: "No matching payment", transactionId: txRef });
    }

    const isSuccessEvent = normalizedEvent === "payment.success" || normalizedStatus === "success";
    const isFailureEvent =
      normalizedEvent === "payment.failed" ||
      normalizedEvent === "payment.cancelled" ||
      normalizedStatus === "failed" ||
      normalizedStatus === "cancelled";

    if (isSuccessEvent) {
      if (payment.status !== "PAID") {
        // Never fulfill off the webhook body alone — confirm directly with
        // the Link status endpoint (authoritative for both status and the
        // amount actually paid) before creating any ticket.
        let statusData;
        try {
          statusData = await ChapaGiftCardService.getPaymentStatus(
            payment.giftCardLinkReference || link_app_reference
          );
        } catch (err) {
          console.error("[GIFTCARD-WEBHOOK] Status check failed:", err.message);
          return res.status(502).json({ error: "Could not verify payment with Chapa Link" });
        }

        const verifiedStatus = String(statusData?.status || "").toLowerCase();
        const verifiedAmount = Number(statusData?.amount) / 100; // cents -> major unit

        if (verifiedStatus !== "success" || !amountsMatch(verifiedAmount, payment.price)) {
          await flagTamperAttempt({
            phone: payment.paymentPhone || payment.contact,
            userId: payment.userId,
            reason: "Chapa Link webhook claimed success but status check disagreed",
            meta: {
              transactionId: txRef,
              expectedAmount: payment.price,
              verifiedAmount,
              verifiedStatus,
            },
          });
          return res.status(400).json({ error: "Payment could not be verified with Chapa Link" });
        }

        payment.status = "PAID";
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
        normalizedEvent === "payment.cancelled" || normalizedStatus === "cancelled"
          ? "CANCELLED"
          : "FAILED";
      await payment.save();

      return res.status(200).json({
        message: "Webhook processed with failed/cancelled status",
        transactionId: txRef,
        paymentStatus: payment.status,
      });
    }

    return res.status(200).json({
      message: "Event not handled",
      transactionId: txRef,
    });
  } catch (error) {
    console.error("[GIFTCARD-WEBHOOK] error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  chapaWebhook,
  chapaGiftCardWebhook,
};
