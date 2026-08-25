const SantimPayService = require("../services/santimPayService");
const SantimTransaction = require("../models/SantimTransaction");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const { StatusCodes } = require("http-status-codes");
const {
  createAndSendProfessionalInvitation,
  processPaidInvitations,
} = require("./invitationController");
const { processGuestInvitation } = require("./ticketController");
const { claimTicketStock, releaseTicketStock } = require("../utils/ticketStock");
const { markSantimTransactionTerminal } = require("../utils/paymentHold");
const { resolveTicketPrice, amountsMatch } = require("../utils/pricing");
const { isPhoneBanned, flagTamperAttempt } = require("../utils/fraudGuard");

// These two routes (savePendingTransaction / fulfillPayment) are only ever
// meant to be called server-to-server (e.g. from a Next.js API route), never
// directly by a browser or Postman. They carry no session/JWT, so a shared
// secret is the only thing standing between them and anyone on the internet.
const INTERNAL_PAYMENTS_SECRET = process.env.INTERNAL_PAYMENTS_SECRET;

const hasValidInternalSecret = (req) =>
  Boolean(INTERNAL_PAYMENTS_SECRET) &&
  req.headers["x-internal-secret"] === INTERNAL_PAYMENTS_SECRET;

// Consolidated Fulfillment Logic
const processTransactionFulfillment = async (transaction, paymentId) => {
  try {
    // Atomic idempotency gate — a plain read-then-write here let a webhook
    // and a concurrent fulfillPayment/poll call both pass the `!== "COMPLETED"`
    // check before either had saved, and both proceed into ticket creation.
    // Only whichever `findOneAndUpdate` reaches Mongo first actually flips
    // the status; the other gets null back and is done.
    const claimed = await SantimTransaction.findOneAndUpdate(
      { _id: transaction._id, status: { $ne: "COMPLETED" } },
      {
        $set: {
          status: "COMPLETED",
          ...(paymentId ? { santimPayReference: paymentId } : {}),
        },
      },
      { new: true }
    );

    if (!claimed) {
      console.log(
        `Transaction ${transaction.transactionId} already completed.`
      );
      return;
    }

    console.log(`Fulfilling transaction ${claimed.transactionId}...`);

    const meta = claimed.metaData;

    // 1. Ticket Purchase
    if (
      meta.eventId &&
      meta.ticketTypeId &&
      meta.type !== "professional_invitation"
    ) {
      await generateTicketsForTransaction(claimed);
    }
    // 2. Professional Invitation
    else if (meta.type === "professional_invitation") {
      console.log("Processing professional invitation fulfillment...");
      if (meta.pendingInvitationIds && meta.pendingInvitationIds.length > 0) {
        // Bulk Invitation Flow
        console.log(
          `Processing bulk invitations: ${meta.pendingInvitationIds.length} items`
        );
        await processPaidInvitations(meta.pendingInvitationIds, paymentId);
      } else if (meta.ticketId) {
        // New flow: Process guest ticket invitation
        console.log(
          `Processing guest invitation for ticketId: ${meta.ticketId}`
        );
        try {
          await processGuestInvitation(meta.ticketId);
          console.log(
            `Successfully processed guest invitation for ticketId: ${meta.ticketId}`
          );
        } catch (err) {
          console.error(
            `Failed to process guest invitation for ticketId: ${meta.ticketId}`,
            err
          );
        }
      } else if (meta.invitationId) {
        // If we have a pending invitation ID, process it
        console.log(
          `Processing paid invitation for invitationId: ${meta.invitationId}`
        );
        await processPaidInvitations([meta.invitationId], paymentId);
      } else {
        // Legacy/Fallback: Create new if no ID provided
        console.log("Creating new professional invitation (legacy flow)...");
        const invitation = await createAndSendProfessionalInvitation({
          eventId: meta.eventId,
          organizerId: meta.userId,
          guestName: meta.fullName,
          guestEmail: meta.email,
          guestPhone: meta.phoneNumber,
          type: meta.contactType,
          amount: meta.quantity,
          message: meta.message,
          guestType: meta.guestType,
        });
        // Update payment reference for legacy flow if possible
        if (invitation && paymentId) {
          invitation.paymentReference = paymentId;
          await invitation.save();
        }
      }
    } else {
      console.warn(
        "Unknown transaction type or missing metadata for fulfillment:",
        meta
      );
    }
  } catch (error) {
    console.error("Error in processTransactionFulfillment:", error);
    throw error; // Re-throw to be caught by caller
  }
};

// Initiate Payment (Frontend Request)
const initiatePayment = async (req, res) => {
  try {
    const {
      amount,
      paymentReason,
      phoneNumber,
      txnId,
      fullName,
      email,
      ticketTypeId,
      eventId,
      quantity,
      userId,
      selectedMethod,
      successUrl,
    } = req.body;

    if (!amount || !paymentReason || !txnId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (phoneNumber && (await isPhoneBanned(phoneNumber))) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        code: "PHONE_BANNED",
        message: "This number is not permitted to make purchases.",
      });
    }

    // The charge amount is always computed from the event's own ticket type
    // data — never from the client-supplied `amount`. A mismatch means the
    // request has been tampered with.
    const pricing = await resolveTicketPrice({ eventId, ticketTypeId, quantity });
    if (!pricing.ok) {
      return res.status(pricing.statusCode).json({ success: false, message: pricing.message });
    }

    if (!amountsMatch(amount, pricing.amount)) {
      if (phoneNumber) {
        await flagTamperAttempt({
          phone: phoneNumber,
          userId,
          reason: "Amount mismatch on POST /api/payments/santimpay/initiate",
          meta: { eventId, ticketTypeId, quantity, submittedAmount: amount, expectedAmount: pricing.amount },
        });
      }
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Payment amount could not be verified.",
      });
    }

    const verifiedAmount = pricing.amount;

    // Define redirect URLs
    const baseUrl = process.env.FRONTEND_URL || "https://pazimo.com";
    const backendUrl =
      process.env.BACKEND_URL || "https://pazimoapp.testserveret.com";

    const successRedirectUrl =
      successUrl || `${baseUrl}/payment/success?txn=${txnId}`;
    const failureRedirectUrl = `${baseUrl}/payment/failure?txn=${txnId}`;
    const cancelRedirectUrl = `${baseUrl}/payment/cancel?txn=${txnId}`;
    const notifyUrl = `${backendUrl}/api/webhook/santimpay`;

    // Reserve the stock now, before the customer is asked to pay — not at
    // fulfillment time. See ticketRoutes.js's initiate handlers for the
    // full rationale (prevents two buyers both paying for the last unit,
    // and a wave transition mid-checkout minting a ticket at the wrong
    // price). Rejecting here also saves the SantimPay API call entirely.
    const stockClaim = await claimTicketStock({
      eventId: pricing.event._id,
      ticketTypeId: pricing.ticketType._id,
      ticketTypeName: pricing.ticketType.name,
      count: pricing.quantity,
    });

    if (!stockClaim.claimed) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "This ticket type just sold out.",
      });
    }

    const stockHeldAt = new Date();

    let result;
    try {
      result = await SantimPayService.initiatePayment({
        amount: verifiedAmount,
        paymentReason,
        successRedirectUrl,
        failureRedirectUrl,
        cancelRedirectUrl,
        notifyUrl,
        phoneNumber,
        transactionId: txnId,
        paymentMethod: selectedMethod,
      });

      // Save Transaction to DB with Metadata
      await SantimTransaction.create({
        transactionId: result.transactionId,
        merchantId: SantimPayService.merchantId,
        amount: verifiedAmount,
        paymentReason,
        status: "PENDING",
        paymentUrl: result.paymentUrl,
        santimPayReference: result.paymentId,
        ticketTypeId: pricing.ticketType._id,
        stockHeldAt,
        metaData: {
          fullName,
          email,
          phoneNumber,
          ticketTypeId,
          eventId,
          quantity: quantity.toString(),
          userId: userId || "",
        },
      });
    } catch (error) {
      await releaseTicketStock({
        eventId: pricing.event._id,
        ticketTypeId: pricing.ticketType._id,
        ticketTypeName: pricing.ticketType.name,
        count: pricing.quantity,
      }).catch((releaseError) =>
        console.error(
          `[SANTIMPAY-INIT] Failed to release stock after initiate failure for txn ${txnId}:`,
          releaseError
        )
      );
      throw error;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      paymentUrl: result.paymentUrl,
      txnId: result.transactionId,
    });
  } catch (error) {
    console.error("Initiate Payment Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

const User = require("../models/User");

// Helper to generate tickets
const generateTicketsForTransaction = async (transaction) => {
  try {
    // Access metaData directly as it is now a sub-document
    const meta = transaction.metaData;

    if (meta.eventId && meta.ticketTypeId) {
      const { eventId, ticketTypeId, quantity, userId } = meta;
      const event = await Event.findById(eventId);
      if (event) {
        const qty = parseInt(quantity);
        const selectedType = event.ticketTypes.find(
          (t) => t.name === ticketTypeId || t._id.toString() === ticketTypeId
        );

        if (selectedType) {
          // Stock is normally already reserved — claimTicketStock now runs
          // at checkout-initiation (initiatePayment/savePendingTransaction
          // above), not here at fulfillment. Trust that hold instead of
          // re-claiming (which would double-decrement).
          //
          // Re-read the hold fields fresh from the DB rather than trusting
          // whatever `transaction` this function was handed — the caller
          // may have loaded it before the expiry sweep concurrently
          // released an abandoned hold, and a stale in-memory copy would
          // wrongly treat an already-released hold as still good.
          const holdState = await SantimTransaction.findById(
            transaction._id
          ).select("stockHeldAt stockReleasedAt");
          const holdStillValid =
            holdState?.stockHeldAt && !holdState?.stockReleasedAt;

          let totalPrice;

          if (holdStillValid) {
            // Trust the reservation: no claim here, and price comes from
            // what was actually verified and captured at initiate time —
            // never re-read live, or a wave transition between initiate and
            // fulfillment could mint a ticket at a different price than
            // what the customer was charged.
            totalPrice = Number(transaction.amount || 0);
          } else {
            // No live hold (legacy transaction from before this existed, or
            // the expiry sweep already released it) — fall back to claiming
            // now, same as this function always did. `requireAvailable:
            // false` because the customer has already paid — the seat must
            // be honoured even if the wave flipped mid-checkout, as long as
            // stock is physically left.
            const stockClaim = await claimTicketStock({
              eventId: event._id,
              ticketTypeId: selectedType._id,
              ticketTypeName: selectedType.name,
              count: qty,
              requireAvailable: false,
            });

            if (!stockClaim.claimed) {
              // The customer has already paid — do not silently skip ticket
              // creation as this used to (that minted no ticket *and* left
              // no trace of why). Flag for manual follow-up instead — no
              // refund automation exists yet.
              console.error(
                `[SANTIMPAY] ❌ Stock claim failed for already-completed transaction ${transaction.transactionId} — flagging for manual review.`
              );
              await SantimTransaction.updateOne(
                { _id: transaction._id },
                { $set: { needsManualReview: true } }
              );
              return;
            }

            totalPrice = selectedType.price * qty;
          }

          // Create a single ticket with the total quantity
          const ticket = new Ticket({
            event: event._id,
            user: userId || null,
            ticketType: selectedType.name,
            ticketTypeId: selectedType._id,
            price: totalPrice,
            paymentReference: transaction.transactionId,
            status: "active",
            paymentStatus: "completed",
            ticketCount: qty, // Store the quantity
            ticketId: meta.ticketId || undefined, // Use the pre-generated ticketId if available
          });

          // Handle Guest Details if no user
          if (!userId) {
            ticket.isInvitation = true;
            ticket.guestName = meta.fullName || "Guest";
            ticket.guestPhone = meta.phoneNumber;
            ticket.guestEmail = meta.email;
          }

          await ticket.save();

          // Add ticket to user if userId exists
          if (userId) {
            await User.findByIdAndUpdate(userId, {
              $push: { tickets: ticket._id },
            });
          }

          console.log(
            `Generated 1 ticket (count: ${qty}) for transaction ${transaction.transactionId}`
          );
        }
      }
    }
  } catch (error) {
    console.error("Error generating tickets:", error);
  }
};

// Get Payment Status
const getPaymentStatus = async (req, res) => {
  try {
    const { txn, ticketId } = req.query;
    if (!txn && !ticketId) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "Transaction ID or Ticket ID required" });
    }

    let transaction;
    if (txn) {
      transaction = await SantimTransaction.findOne({ transactionId: txn });
    } else if (ticketId) {
      transaction = await SantimTransaction.findOne({
        "metaData.ticketId": ticketId,
      });
    }

    if (!transaction) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Transaction not found" });
    }

    // If pending, verify with SantimPay
    if (transaction.status === "PENDING") {
      try {
        console.log(
          `Verifying transaction ${transaction.transactionId} with SantimPay...`
        );
        const remoteStatus = await SantimPayService.checkTransactionStatus(
          transaction.transactionId
        );
        console.log("SantimPay Remote Status Response:", remoteStatus);

        // SantimPay might return status in different fields depending on version
        // Check for 'status' or 'paymentStatus'
        // Also check if the response itself has a 'status' field (e.g. { status: "SUCCESS", data: { ... } })
        const status =
          remoteStatus.status ||
          remoteStatus.paymentStatus ||
          (remoteStatus.data && remoteStatus.data.status);
        const paymentId =
          remoteStatus.paymentId ||
          remoteStatus.reference ||
          (remoteStatus.data && remoteStatus.data.paymentId);

        console.log(`Extracted Status: ${status}, PaymentId: ${paymentId}`);

        if (status === "COMPLETED" || status === "SUCCESS") {
          await processTransactionFulfillment(transaction, paymentId);
        } else if (status === "FAILED" || status === "CANCELLED") {
          transaction.status = status;
          await markSantimTransactionTerminal({
            transactionId: transaction._id,
            status,
          });
        }
      } catch (err) {
        console.warn("Failed to verify status with SantimPay:", err.message);
        // Continue with existing status
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      status: transaction.status,
      amount: transaction.amount,
      reference: transaction.santimPayReference,
    });
  } catch (error) {
    console.error("Get Status Error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: "Failed to get status" });
  }
};

// Webhook Handler
const handleWebhook = async (req, res) => {
  try {
    const token = req.body.token || req.headers["x-santimpay-signature"];

    if (!token) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ message: "No token provided" });
    }

    const decoded = SantimPayService.verifyWebhook(token);
    const { id, status, paymentId } = decoded;

    const transaction = await SantimTransaction.findOne({ transactionId: id });

    if (!transaction) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Transaction not found" });
    }

    // Only process if status changed and is completed
    if (transaction.status !== "COMPLETED" && status === "COMPLETED") {
      await processTransactionFulfillment(transaction, paymentId);
    } else if (status === "FAILED" || status === "CANCELLED") {
      await markSantimTransactionTerminal({ transactionId: transaction._id, status });
    }

    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Invalid signature or processing error" });
  }
};

// Save Pending Transaction (called by Next.js API)
const savePendingTransaction = async (req, res) => {
  try {
    // Server-to-server only (called from the Next.js backend, never a browser).
    // There's no session/JWT here, so a missing/wrong shared secret is treated
    // as an unauthorized external call, not a misconfiguration.
    if (!hasValidInternalSecret(req)) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log(
      "savePendingTransaction body:",
      JSON.stringify(req.body, null, 2)
    );
    const {
      orderId,
      amount,
      reason,
      phoneNumber,
      ticketData,
      invitationData,
      method,
    } = req.body;

    if (phoneNumber && (await isPhoneBanned(phoneNumber))) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        code: "PHONE_BANNED",
        message: "This number is not permitted to make purchases.",
      });
    }

    // For ticket purchases (as opposed to custom-priced invitations) the
    // amount is always recomputed from the event's own ticket type data.
    let verifiedAmount = amount;
    let ticketPricing = null;
    let stockHeldAt = null;
    if (ticketData?.eventId && ticketData?.ticketTypeId) {
      const pricing = await resolveTicketPrice({
        eventId: ticketData.eventId,
        ticketTypeId: ticketData.ticketTypeId,
        quantity: ticketData.quantity,
      });
      if (!pricing.ok) {
        return res.status(pricing.statusCode).json({ success: false, message: pricing.message });
      }
      if (!amountsMatch(amount, pricing.amount)) {
        if (phoneNumber) {
          await flagTamperAttempt({
            phone: phoneNumber,
            userId: ticketData.userId,
            reason: "Amount mismatch on POST /api/payments/santim/save-pending",
            meta: {
              eventId: ticketData.eventId,
              ticketTypeId: ticketData.ticketTypeId,
              quantity: ticketData.quantity,
              submittedAmount: amount,
              expectedAmount: pricing.amount,
            },
          });
        }
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "Payment amount could not be verified.",
        });
      }
      verifiedAmount = pricing.amount;
      ticketPricing = pricing;

      // Reserve the stock now — Next.js has already sent this payment
      // request to SantimPay before this server-to-server call arrives, but
      // nothing has decremented inventory on this side yet. Claiming here,
      // atomically, is what stops two such payments both landing on the
      // same last unit.
      const stockClaim = await claimTicketStock({
        eventId: pricing.event._id,
        ticketTypeId: pricing.ticketType._id,
        ticketTypeName: pricing.ticketType.name,
        count: pricing.quantity,
      });

      if (!stockClaim.claimed) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: "This ticket type just sold out.",
        });
      }

      stockHeldAt = new Date();
    }

    const merchantId = SantimPayService.merchantId;
    console.log("Merchant ID:", merchantId);

    if (!merchantId) {
      console.error("Merchant ID is missing in configuration");
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Server configuration error: Merchant ID missing",
      });
    }

    // Validate and sanitize pendingInvitationIds
    let pendingInvitationIds = [];
    if (invitationData && invitationData.pendingInvitationIds) {
      const rawIds = invitationData.pendingInvitationIds;
      if (Array.isArray(rawIds)) {
        pendingInvitationIds = rawIds.map((id) => String(id));
      } else if (typeof rawIds === "string") {
        try {
          // Try parsing if it's a JSON string
          if (rawIds.startsWith("[") && rawIds.endsWith("]")) {
            const parsed = JSON.parse(rawIds);
            if (Array.isArray(parsed)) {
              pendingInvitationIds = parsed.map((id) => String(id));
            }
          } else {
            pendingInvitationIds = [rawIds];
          }
        } catch (e) {
          console.warn(
            "Failed to parse pendingInvitationIds string, using as single ID",
            e
          );
          pendingInvitationIds = [rawIds];
        }
      }
    }

    // Construct metaData strictly
    const metaData = {
      fullName: ticketData?.fullName || invitationData?.fullName || "",
      email: ticketData?.email || invitationData?.email || "",
      phoneNumber:
        phoneNumber ||
        ticketData?.phoneNumber ||
        invitationData?.phoneNumber ||
        "",
      ticketTypeId: ticketData?.ticketTypeId || "",
      eventId: ticketData?.eventId || invitationData?.eventId || "",
      quantity: ticketData?.quantity
        ? String(ticketData.quantity)
        : invitationData?.quantity
        ? String(invitationData.quantity)
        : "0",
      userId: ticketData?.userId || invitationData?.userId || "",
      ticketId: ticketData?.ticketId || invitationData?.ticketId || "", // Store the frontend generated ticketId
      type: invitationData?.type || "ticket_purchase", // Default type
      contactType: invitationData?.contactType || "",
      guestType: invitationData?.guestType || "",
      message: invitationData?.message || "",
      pendingInvitationIds: pendingInvitationIds,
      invitationId: invitationData?.invitationId || "", // Store the pending invitation ID
    };

    // Save to SantimTransaction
    console.log("Creating SantimTransaction with:", {
      transactionId: orderId,
      merchantId,
      amount: verifiedAmount,
      paymentReason: reason,
      status: "PENDING",
      metaData,
    });

    try {
      await SantimTransaction.create({
        transactionId: orderId,
        merchantId,
        amount: verifiedAmount,
        paymentReason: reason,
        status: "PENDING",
        ...(ticketPricing
          ? { ticketTypeId: ticketPricing.ticketType._id, stockHeldAt }
          : {}),
        metaData,
      });
    } catch (createError) {
      if (ticketPricing) {
        await releaseTicketStock({
          eventId: ticketPricing.event._id,
          ticketTypeId: ticketPricing.ticketType._id,
          ticketTypeName: ticketPricing.ticketType.name,
          count: ticketPricing.quantity,
        }).catch((releaseError) =>
          console.error(
            `[SANTIMPAY-SAVE-PENDING] Failed to release stock after create failure for txn ${orderId}:`,
            releaseError
          )
        );
      }
      throw createError;
    }

    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error("Save Pending Error Full:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message, stack: error.stack });
  }
};

// Fulfill Payment (called by Next.js Webhook)
const fulfillPayment = async (req, res) => {
  try {
    const { id, paymentId } = req.body;

    // Server-to-server only. A caller without the shared secret is not our
    // Next.js backend — treat it as a forged-fulfillment attempt.
    if (!hasValidInternalSecret(req)) {
      const suspectTransaction = id
        ? await SantimTransaction.findOne({ transactionId: id })
        : null;
      if (suspectTransaction?.metaData?.phoneNumber) {
        await flagTamperAttempt({
          phone: suspectTransaction.metaData.phoneNumber,
          userId: suspectTransaction.metaData.userId,
          reason: "Unauthorized call to POST /api/payments/santim/webhook-fulfill",
          meta: { transactionId: id },
        });
      }
      return res.status(StatusCodes.UNAUTHORIZED).json({ success: false, message: "Unauthorized" });
    }

    const transaction = await SantimTransaction.findOne({ transactionId: id });

    if (!transaction) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Transaction not found" });
    }

    // Never trust a caller-claimed status — always confirm directly with
    // SantimPay before fulfilling. This is what previously let anyone who
    // knew (or guessed) a transactionId fulfill it themselves for free.
    let remoteStatus;
    try {
      remoteStatus = await SantimPayService.checkTransactionStatus(id);
    } catch (err) {
      console.error("Fulfill Payment - remote status check failed:", err.message);
      return res.status(StatusCodes.BAD_GATEWAY).json({
        success: false,
        message: "Could not verify payment status with SantimPay",
      });
    }

    const remoteStatusValue =
      remoteStatus.status ||
      remoteStatus.paymentStatus ||
      (remoteStatus.data && remoteStatus.data.status);

    if (
      transaction.status !== "COMPLETED" &&
      (remoteStatusValue === "COMPLETED" || remoteStatusValue === "SUCCESS")
    ) {
      await processTransactionFulfillment(transaction, paymentId);
    } else if (remoteStatusValue === "FAILED" || remoteStatusValue === "CANCELLED") {
      await markSantimTransactionTerminal({
        transactionId: transaction._id,
        status: remoteStatusValue,
      });
    }

    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    console.error("Fulfill Payment Error:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

module.exports = {
  initiatePayment,
  handleWebhook,
  getPaymentStatus,
  savePendingTransaction,
  fulfillPayment,
  // Exported for direct testing — no route calls these by name.
  processTransactionFulfillment,
  generateTicketsForTransaction,
};
