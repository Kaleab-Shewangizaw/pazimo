const SantimPayService = require("../services/santimPayService");
const SantimTransaction = require("../models/SantimTransaction");
const Ticket = require("../models/Ticket");
const Event = require("../models/Event");
const { StatusCodes } = require("http-status-codes");

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
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";

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
        const remoteStatus = await SantimPayService.checkTransactionStatus(
          transaction.transactionId
        );
        // SantimPay might return status in different fields depending on version
        const status = remoteStatus.status || remoteStatus.paymentStatus;
        const paymentId = remoteStatus.paymentId || remoteStatus.reference;

        if (status === "COMPLETED" || status === "SUCCESS") {
          transaction.status = "COMPLETED";
          transaction.santimPayReference = paymentId;
          await transaction.save();
          await generateTicketsForTransaction(transaction);
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
      transaction.status = "COMPLETED";
      transaction.santimPayReference = paymentId;
      await transaction.save();
      await generateTicketsForTransaction(transaction);
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
      fullName: ticketData?.fullName || "",
      email: ticketData?.email || "",
      phoneNumber: phoneNumber || ticketData?.phoneNumber || "",
      ticketTypeId: ticketData?.ticketTypeId || "",
      eventId: ticketData?.eventId || "",
      quantity: ticketData?.quantity ? String(ticketData.quantity) : "0",
      userId: ticketData?.userId || "",
      ticketId: ticketData?.ticketId || "", // Store the frontend generated ticketId
      type: invitationData?.type || "ticket_purchase", // Default type
      pendingInvitationIds: pendingInvitationIds,
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
      transaction.status = "COMPLETED";
      transaction.santimPayReference = paymentId;
      await transaction.save();

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
              paymentReference: id, // Use transaction ID as reference
              status: "active",
              paymentStatus: "completed",
              ticketCount: qty, // Store the quantity
              ticketId: meta.ticketId || undefined, // Use the pre-generated ticketId if available
            });
            await ticket.save();

            // Add ticket to user if userId exists
            if (userId) {
              await User.findByIdAndUpdate(userId, {
                $push: { tickets: ticket._id },
              });
            }

            console.log(
              `Generated 1 ticket (count: ${qty}) for transaction ${id}`
            );
          }
        }
      }
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
