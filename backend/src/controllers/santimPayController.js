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

// Consolidated Fulfillment Logic
const processTransactionFulfillment = async (transaction, paymentId) => {
  try {
    // If already completed, do nothing (idempotency)
    if (transaction.status === "COMPLETED") {
      console.log(
        `Transaction ${transaction.transactionId} already completed.`
      );
      return;
    }

    console.log(`Fulfilling transaction ${transaction.transactionId}...`);
    transaction.status = "COMPLETED";
    if (paymentId) {
      transaction.santimPayReference = paymentId;
    }
    await transaction.save();

    const meta = transaction.metaData;

    // 1. Ticket Purchase
    if (
      meta.eventId &&
      meta.ticketTypeId &&
      meta.type !== "professional_invitation"
    ) {
      await generateTicketsForTransaction(transaction);
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

    // Define redirect URLs
    const baseUrl = process.env.FRONTEND_URL || "https://pazimo.vercel.app";
    const backendUrl =
      process.env.BACKEND_URL || "https://pazimoapp.testserveret.com";

    const successRedirectUrl =
      successUrl || `${baseUrl}/payment/success?txn=${txnId}`;
    const failureRedirectUrl = `${baseUrl}/payment/failure?txn=${txnId}`;
    const cancelRedirectUrl = `${baseUrl}/payment/cancel?txn=${txnId}`;
    const notifyUrl = `${backendUrl}/api/webhook/santimpay`;

    const result = await SantimPayService.initiatePayment({
      amount,
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
      amount,
      paymentReason,
      status: "PENDING",
      paymentUrl: result.paymentUrl,
      santimPayReference: result.paymentId,
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
          const typeIndex = event.ticketTypes.indexOf(selectedType);
          if (typeIndex > -1) {
            event.ticketTypes[typeIndex].quantity = Math.max(
              0,
              event.ticketTypes[typeIndex].quantity - qty
            );
            await event.save();
          }

          // Create a single ticket with the total quantity
          const ticket = new Ticket({
            event: event._id,
            user: userId || null,
            ticketType: selectedType.name,
            price: selectedType.price * qty, // Total price
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
          await transaction.save();
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
      transaction.status = status;
      await transaction.save();
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
      amount,
      paymentReason: reason,
      status: "PENDING",
      metaData,
    });

    await SantimTransaction.create({
      transactionId: orderId,
      merchantId,
      amount,
      paymentReason: reason,
      status: "PENDING",
      metaData,
    });

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
    const { id, status, paymentId } = req.body;

    const transaction = await SantimTransaction.findOne({ transactionId: id });

    if (!transaction) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ message: "Transaction not found" });
    }

    if (
      transaction.status !== "COMPLETED" &&
      (status === "COMPLETED" || status === "SUCCESS")
    ) {
      await processTransactionFulfillment(transaction, paymentId);
    } else if (status === "FAILED" || status === "CANCELLED") {
      transaction.status = status;
      await transaction.save();
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
};
