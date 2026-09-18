const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authenticateUser, protect, restrictTo } = require("../middlewares/auth");

const {
  createTicket,
  getUserTickets,
  getTransferableTickets,
  getEventTickets,
  checkInTicket,
  cancelTicket,
  getTicket,
  getAllTicketsAdmin,
  validateQRCode,
  getTicketDetails,
  createInvitationTicket,
  getInvitationTicket,
  updateInvitationTicketStatus,
  createGuestTicket,
  sendGuestInvitation,
  confirmRSVP,
  getPublicTicketDetails,
  cancelPaymentIntent,
  createOnDoorTicket,
  getOrganizerTickets,
  deleteTicket,
  getTicketQr,
} = require("../controllers/ticketController");

const SantimPayService = require("../services/santimPayService");
const ChapaService = require("../services/chapaService");
const ChapaGiftCardService = require("../services/chapaGiftCardService");
const User = require("../models/User");
const Event = require("../models/Event");
const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const { resolveTicketPrice, amountsMatch } = require("../utils/pricing");
const { isPhoneBanned, flagTamperAttempt } = require("../utils/fraudGuard");
const { claimTicketStock, releaseTicketStock } = require("../utils/ticketStock");
const { isQueryOperatorInjection } = require("../utils/rejectQueryOperators");

const resolveWebhookBaseUrl = (req) => {
  const explicitPublicUrl =
    process.env.CHAPA_WEBHOOK_BASE_URL || process.env.BACKEND_PUBLIC_URL;
  if (explicitPublicUrl) {
    return explicitPublicUrl.replace(/\/$/, "");
  }

  const configuredBackendUrl = process.env.BACKEND_URL;
  if (
    configuredBackendUrl &&
    !/localhost|127\.0\.0\.1/i.test(configuredBackendUrl)
  ) {
    return configuredBackendUrl.replace(/\/$/, "");
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  if (forwardedHost && !/localhost|127\.0\.0\.1/i.test(forwardedHost)) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    return `${protocol}://${forwardedHost}`.replace(/\/$/, "");
  }

  return (configuredBackendUrl || "http://localhost:5000").replace(/\/$/, "");
};

const findEventForTicketPurchase = async (eventId) => {
  if (!eventId) {
    return null;
  }

  const normalizedEventId = String(eventId).trim();

  if (mongoose.Types.ObjectId.isValid(normalizedEventId)) {
    const eventById = await Event.findById(normalizedEventId);
    if (eventById) {
      return eventById;
    }
  }

  return Event.findOne({ shortId: normalizedEventId.toLowerCase() });
};

// Restores the pre-2026-09-15 "log in or create an account inline while
// paying" flow (dropped in d3ba065, "require sign-in for ticket purchase,
// drop guest checkout") for the web checkout only — see the /web route
// variants below. /ticket/initiate and /ticket/initiate/chapa stay behind
// plain authenticateUser (no change): pazimo-mobile already calls those and
// already has its own OTP-backed sign-up/sign-in flow built for them.
//
// A Bearer token, if present, is verified exactly like authenticateUser —
// a signed-in web user goes through this unchanged. Only an anonymous
// request falls into guest checkout, and only when ACTIVATE_PASSWORDLESS_ROUTE
// is "true" — a single env flip kills it instantly if it's abused the way
// unifiedAuth was on 2026-09-03 (same isQueryOperatorInjection guard as that
// incident is applied here too, since this does the same
// find-by-phone/email-from-request-body query).
const webCheckoutAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticateUser(req, res, next);
  }

  if (process.env.ACTIVATE_PASSWORDLESS_ROUTE !== "true") {
    return res.status(401).json({
      success: false,
      error: "Please sign in to buy tickets.",
    });
  }

  const { ticketDetails = {}, phoneNumber } = req.body || {};
  const { fullName, email } = ticketDetails || {};

  if (
    isQueryOperatorInjection(fullName) ||
    isQueryOperatorInjection(email) ||
    isQueryOperatorInjection(phoneNumber)
  ) {
    return res.status(400).json({ success: false, error: "Invalid request" });
  }

  if (!email) {
    return res
      .status(400)
      .json({ success: false, error: "Email is required for ticket purchase" });
  }
  if (!phoneNumber) {
    return res
      .status(400)
      .json({ success: false, error: "Phone number is required for ticket purchase" });
  }

  try {
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
    }

    if (!user) {
      const nameParts = (fullName || "Guest User").trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || "Guest";
      const lastName = nameParts.slice(1).join(" ") || "User";

      try {
        user = await User.create({
          firstName,
          lastName,
          email: email.toLowerCase(),
          phoneNumber,
          password: phoneNumber, // Same convention unifiedAuth uses for guest checkout.
          role: "customer",
          isPhoneVerified: true,
          isActive: true,
        });
      } catch (err) {
        if (err.code === 11000) {
          user = await User.findOne({
            $or: [{ email: email.toLowerCase() }, { phoneNumber }],
          });
        }
        if (!user) throw err;
      }
    }

    if (user.isBanned || !user.isActive) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        error: user.banReason || "This account is not permitted to make purchases.",
      });
    }

    req.user = { userId: user._id.toString(), role: user.role };
    req.guestCheckoutAuth = {
      token: user.createJWT(),
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    };
    next();
  } catch (error) {
    console.error("[WEB-CHECKOUT-AUTH] Guest checkout failed:", error);
    res.status(500).json({ success: false, error: "Could not start checkout" });
  }
};

// Requires a signed-in account — ticket purchase no longer creates a
// password-bearing account behind the scenes (see authenticateUser).
const initiateSantimPayTicket = async (req, res) => {
  try {
    const {
      ticketDetails,
      amount,
      phoneNumber,
      method,
      orderId,
      paymentReason,
    } = req.body;

    if (!ticketDetails) {
      return res
        .status(400)
        .json({ success: false, error: "ticketDetails is required" });
    }

    if (phoneNumber && (await isPhoneBanned(phoneNumber))) {
      return res
        .status(403)
        .json({ success: false, code: "PHONE_BANNED", error: "This number is not permitted to make purchases." });
    }

    // The price is always computed from the event's own ticket type data —
    // never from the client-supplied `amount`. If the client's amount doesn't
    // match, this is a manipulation attempt: log it, warn/ban the phone, and
    // refuse to initiate the payment for the tampered amount.
    const pricing = await resolveTicketPrice({
      eventId: ticketDetails.eventId,
      ticketTypeId: ticketDetails.ticketTypeId,
      quantity: ticketDetails.quantity,
      currency: "ETB",
    });

    if (!pricing.ok) {
      return res.status(pricing.statusCode).json({ success: false, error: pricing.message });
    }

    if (amount !== undefined && !amountsMatch(amount, pricing.amount)) {
      if (phoneNumber) {
        await flagTamperAttempt({
          phone: phoneNumber,
          userId: req.user.userId,
          reason: "Amount mismatch on POST /tickets/ticket/initiate (SantimPay)",
          meta: {
            eventId: ticketDetails.eventId,
            ticketTypeId: ticketDetails.ticketTypeId,
            quantity: ticketDetails.quantity,
            submittedAmount: amount,
            expectedAmount: pricing.amount,
          },
        });
      }
      return res.status(400).json({ success: false, error: "Payment amount could not be verified." });
    }

    const verifiedAmount = pricing.amount;

    // The caller is authenticated (authenticateUser above) — no more
    // guest-checkout account lookup/creation. Ticket purchase requires a
    // real, already-signed-up account.
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // The `phoneNumber` check above only covers the number typed into this
    // specific checkout form. A banned user can dodge it by paying with a
    // fresh, non-blacklisted number while still checking out on their own
    // (banned) account — so also refuse to initiate payment if the signed-in
    // account itself is banned.
    if (user && (user.isBanned || !user.isActive)) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        error: user.banReason || "This account is not permitted to make purchases.",
      });
    }

    const selectedEvent = await findEventForTicketPurchase(ticketDetails.eventId);
    if (!selectedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    const selectedEventId = selectedEvent._id;

    const reason =
      paymentReason ||
      `Ticket purchase: ${selectedEvent.title} - ${ticketDetails.ticketTypeId}`;
    const webhookBaseUrl = resolveWebhookBaseUrl(req);
    const notifyUrl = `${webhookBaseUrl}/api/webhook/santimpay`;

    // Use provided orderId or generate one
    const transactionId =
      orderId ||
      `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Reserve the stock now, before the customer is asked to pay — not at
    // confirmation time. Claiming only at confirmation let two buyers both
    // pay for the last unit (only one claim would later succeed, leaving
    // the other charged with no ticket and no refund path), and let a wave
    // transition mid-checkout mint a ticket at a different price than what
    // was actually charged. Claiming here means a sold-out ticket type is
    // rejected before the customer ever reaches SantimPay.
    const stockClaim = await claimTicketStock({
      eventId: selectedEventId,
      ticketTypeId: pricing.ticketType._id,
      ticketTypeName: pricing.ticketType.name,
      count: pricing.quantity,
    });

    if (!stockClaim.claimed) {
      return res
        .status(400)
        .json({ success: false, error: "This ticket type just sold out." });
    }

    const stockHeldAt = new Date();

    let response;
    try {
      // Call SantimPay directPayment via Service
      response = await SantimPayService.directPayment(
        transactionId,
        verifiedAmount,
        reason,
        notifyUrl,
        phoneNumber,
        method
      );

      console.log("SantimPay payment initiated:", response);

      // Save a “pending” payment record in your DB
      // For logged-in users: use account phone for SMS, store payment phone separately
      // For guest users: use payment phone for account creation and SMS
      await Payment.create({
        transactionId: transactionId,
        status: "PENDING",
        guestName: user ? user.firstName : ticketDetails.fullName, // Use firstName for logged-in users
        contact: user && user.phoneNumber ? user.phoneNumber : phoneNumber, // Use account phone for logged-in users
        paymentPhone: phoneNumber, // Store payment phone separately
        method: method,
        price: verifiedAmount,
        eventId: selectedEventId,
        ticketTypeId: pricing.ticketType._id,
        stockHeldAt,
        userId: userId, // Use the found/created userId
        ticketDetails: {
          ...ticketDetails,
          eventId: selectedEventId,
          ticketType: ticketDetails.ticketTypeId,
          ticketCount: ticketDetails.quantity,
          userId: userId, // ⚡ CRITICAL: Also save in ticketDetails for redundancy
          email: ticketDetails.email ? ticketDetails.email.toLowerCase() : undefined,
        },
      });
    } catch (error) {
      // The gateway call or the Payment write failed after stock was
      // already claimed — give it back rather than stranding it for 15
      // minutes until the expiry sweep gets to it.
      await releaseTicketStock({
        eventId: selectedEventId,
        ticketTypeId: pricing.ticketType._id,
        ticketTypeName: pricing.ticketType.name,
        count: pricing.quantity,
      }).catch((releaseError) =>
        console.error(
          `[PAYMENT-INIT] Failed to release stock after initiate failure for txn ${transactionId}:`,
          releaseError
        )
      );
      throw error;
    }

    console.log(`[PAYMENT-INIT] ✅ Payment created with userId: ${userId}, transactionId: ${transactionId}`);

    // Return transactionId so frontend can poll
    res.json({
      success: true,
      transactionId: transactionId,
      message: "Payment initiated. Please check your phone.",
      // Present only when webCheckoutAuth just logged the buyer in or
      // created their account — lets the web frontend auto-login them
      // without a separate step (mirrors the pre-d3ba065 response shape).
      ...(req.guestCheckoutAuth
        ? { token: req.guestCheckoutAuth.token, user: req.guestCheckoutAuth.user }
        : {}),
    });
  } catch (err) {
    console.error("Error initiating payment:", err);
    res.status(500).json({ success: false, error: "Could not start payment" });
  }
};

// Safe route: mobile app and any already-signed-in caller. Sign-in required.
router.post("/ticket/initiate", authenticateUser, initiateSantimPayTicket);
// Web-only route: lets an anonymous ticket buyer log in or create an account
// inline, gated by ACTIVATE_PASSWORDLESS_ROUTE (see webCheckoutAuth above).
router.post("/ticket/initiate/web", webCheckoutAuth, initiateSantimPayTicket);

// Chapa Payment Initiation Route
const initiateChapaTicket = async (req, res) => {
  try {
    const {
      ticketDetails,
      amount,
      phoneNumber,
      method,
      orderId,
      paymentReason,
      currency = "ETB", // Add currency support, default to ETB
    } = req.body;

    if (!ticketDetails) {
      return res
        .status(400)
        .json({ success: false, error: "ticketDetails is required" });
    }

    if (phoneNumber && (await isPhoneBanned(phoneNumber))) {
      return res
        .status(403)
        .json({ success: false, code: "PHONE_BANNED", error: "This number is not permitted to make purchases." });
    }

    // The price is always computed from the event's own ticket type data —
    // never from the client-supplied `amount`. If the client's amount doesn't
    // match, this is a manipulation attempt: log it, warn/ban the phone, and
    // refuse to initiate the payment for the tampered amount.
    const pricing = await resolveTicketPrice({
      eventId: ticketDetails.eventId,
      ticketTypeId: ticketDetails.ticketTypeId,
      quantity: ticketDetails.quantity,
      currency,
    });

    if (!pricing.ok) {
      return res.status(pricing.statusCode).json({ success: false, error: pricing.message });
    }

    if (amount !== undefined && !amountsMatch(amount, pricing.amount)) {
      if (phoneNumber) {
        await flagTamperAttempt({
          phone: phoneNumber,
          userId: req.user.userId,
          reason: "Amount mismatch on POST /tickets/ticket/initiate/chapa",
          meta: {
            eventId: ticketDetails.eventId,
            ticketTypeId: ticketDetails.ticketTypeId,
            quantity: ticketDetails.quantity,
            submittedAmount: amount,
            expectedAmount: pricing.amount,
          },
        });
      }
      return res.status(400).json({ success: false, error: "Payment amount could not be verified." });
    }

    const verifiedAmount = pricing.amount;

    // The caller is authenticated (authenticateUser above) — no more
    // guest-checkout account lookup/creation. Ticket purchase requires a
    // real, already-signed-up account.
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // The `phoneNumber` check above only covers the number typed into this
    // specific checkout form. A banned user can dodge it by paying with a
    // fresh, non-blacklisted number while still checking out on their own
    // (banned) account — so also refuse to initiate payment if the signed-in
    // account itself is banned.
    if (user && (user.isBanned || !user.isActive)) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BANNED",
        error: user.banReason || "This account is not permitted to make purchases.",
      });
    }

    const selectedEvent = await findEventForTicketPurchase(ticketDetails.eventId);
    if (!selectedEvent) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    const selectedEventId = selectedEvent._id;

    const reason =
      paymentReason ||
      `Ticket purchase: ${selectedEvent.title} - ${ticketDetails.ticketTypeId}`;

    const transactionId =
      orderId ||
      `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Gift-card routing: when enabled, ticket payments settle into a Chapa
    // Link gift card (selected per currency) instead of the merchant balance.
    const paymentConfig = await PaymentConfig.findOne();
    const giftCardTarget = paymentConfig?.giftCardMode
      ? paymentConfig.giftCardRouting?.[currency]
      : null;

    if (paymentConfig?.giftCardMode && !giftCardTarget) {
      return res.status(400).json({
        success: false,
        error: `Gift card routing is enabled but no ${currency} gift card is configured. Set one in Admin → Finance.`,
      });
    }

    // Chapa specific URLs
    const webhookBaseUrl = resolveWebhookBaseUrl(req);
    const chapaCallbackUrl = `${webhookBaseUrl}/api/webhooks/chapa`;

    if (/localhost|127\.0\.0\.1/i.test(chapaCallbackUrl)) {
      console.warn(
        "[CHAPA-INIT] ⚠️ callback_url points to localhost. Chapa webhook will not reach this server from the internet. Configure CHAPA_WEBHOOK_BASE_URL or BACKEND_PUBLIC_URL."
      );
    }
    const returnUrl =
      req.body.successUrl ||
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment/success?txn=${transactionId}`;

    // ⚠️ CRITICAL LOG: Verify return_url is correct for Visa/Cardinal Commerce redirect
    console.log(`[CHAPA-INIT] 🔴 CRITICAL - Chapa Redirect Configuration:`, {
      transactionId,
      returnUrl,
      frontendUrl: process.env.FRONTEND_URL,
      nodeEnv: process.env.NODE_ENV,
      callbackUrl: chapaCallbackUrl,
      paymentMethod: method,
    });

    // Map payment method to Chapa supported types (case-sensitive)
    let chapaType = "telebirr"; // Default
    let useWebCheckout = false; // Flag for web checkout vs direct charge
    
    if (method) {
      const methodInput = method.toLowerCase().trim();
      if (methodInput === "visa" || methodInput === "mastercard") {
        // For card payments, use web checkout which supports multiple card types
        useWebCheckout = true;
        chapaType = null; // Web checkout doesn't need specific type
      } else if (methodInput === "mpesa") {
        chapaType = "mpesa";
      } else if (methodInput === "telebirr") {
        chapaType = "telebirr";
      } else if (
        methodInput.includes("cbe") ||
        methodInput === "cbebirr" ||
        methodInput === "commercial bank of ethiopia"
      ) {
        chapaType = "cbebirr";
      } else if (
        methodInput.includes("awash") ||
        methodInput === "awashbirr" ||
        methodInput === "awash bank"
      ) {
        chapaType = "awashbirr";
      } else if (methodInput === "amole") {
        chapaType = "Amole";
      } else if (
        methodInput === "boa_ussd" ||
        methodInput.includes("boa") ||
        methodInput.includes("abyssinia")
      ) {
        // BOA USSD direct charge — Chapa handles this via /v1/charges?type=boa_ussd
        chapaType = "boa_ussd";
      }
    }

    // Reserve the stock now, before the customer is asked to pay — not at
    // confirmation time. Claiming only at confirmation let two buyers both
    // pay for the last unit (only one claim would later succeed, leaving
    // the other charged with no ticket and no refund path), and let a wave
    // transition mid-checkout mint a ticket at a different price than what
    // was actually charged. Claiming here means a sold-out ticket type is
    // rejected before the customer ever reaches Chapa.
    const stockClaim = await claimTicketStock({
      eventId: selectedEventId,
      ticketTypeId: pricing.ticketType._id,
      ticketTypeName: pricing.ticketType.name,
      count: pricing.quantity,
    });

    if (!stockClaim.claimed) {
      return res
        .status(400)
        .json({ success: false, error: "This ticket type just sold out." });
    }

    const stockHeldAt = new Date();
    const releaseStockHold = () =>
      releaseTicketStock({
        eventId: selectedEventId,
        ticketTypeId: pricing.ticketType._id,
        ticketTypeName: pricing.ticketType.name,
        count: pricing.quantity,
      }).catch((releaseError) =>
        console.error(
          `[CHAPA-INIT] Failed to release stock after initiate failure for txn ${transactionId}:`,
          releaseError
        )
      );

    // Call Chapa - use web checkout for card payments or direct charge for mobile money
    let response;
    let giftCardLinkReference = null;
    try {
      if (giftCardTarget) {
        // Gift-card mode: settle into the configured Chapa Link card instead
        // of the merchant balance. The Link API stores amounts in cents.
        const cents = Math.round(verifiedAmount * 100);
        console.log(
          `[CHAPA-INIT] Routing ticket payment into gift card ${giftCardTarget} (${currency}, ${cents} cents)`
        );

        if (useWebCheckout) {
          const result = await ChapaGiftCardService.topUpHosted({
            card_number: giftCardTarget,
            amount: cents,
            merchant_reference: transactionId,
          });
          giftCardLinkReference = result?.link_reference || null;
          response = {
            status: "success",
            data: { checkout_url: result?.checkout_url || null },
          };
        } else {
          let chapaMobile = phoneNumber.replace(/^\+/, "");
          if (chapaMobile.startsWith("251")) {
            chapaMobile = "0" + chapaMobile.substring(3);
          }
          const result = await ChapaGiftCardService.topUpDirectCharge({
            card_number: giftCardTarget,
            amount: cents,
            phone_number: chapaMobile,
            payment_method: chapaType,
            merchant_reference: transactionId,
          });
          giftCardLinkReference = result?.link_reference || null;
          response = { status: "success", data: {} };
        }
      } else if (useWebCheckout) {
        // Web checkout for Visa/Mastercard
        const txRef = transactionId;
        console.log(`[CHAPA-INIT] Using WEB CHECKOUT for card payment. Currency: ${currency}`);
        
        // Chapa web checkout validates phone_number must be in 09.../07... format (10 digits).
        // Convert +251.../251... → 09..., and omit entirely for international numbers.
        let chapaPhone = null;
        if (phoneNumber) {
          let stripped = phoneNumber.replace(/[\s+]/g, "");
          if (stripped.startsWith("251")) stripped = "0" + stripped.substring(3);
          if (stripped.startsWith("09") || stripped.startsWith("07")) chapaPhone = stripped;
          // else: international number — leave chapaPhone as null (omitted from payload)
        }

        const initializePayload = {
          amount: String(verifiedAmount),
          currency: currency, // Pass currency (ETB or USD)
          email: user ? user.email : ticketDetails.email || "guest@example.com",
          first_name: ticketDetails.fullName.split(" ")[0],
          last_name: ticketDetails.fullName.split(" ")[1] || "User",
          ...(chapaPhone && { phone_number: chapaPhone }), // Only include for Ethiopian numbers in 09/07 format
          tx_ref: txRef,
          callback_url: chapaCallbackUrl,
          return_url: returnUrl,
          customization: {
            title: reason.substring(0, 16), // Chapa enforces max 16 chars
            description: "Ticket Purchase",
          },
        };
        
        console.log(`[CHAPA-INIT] 🟢 Web Checkout Payload (Visa Card Payment):`, {
          amount: initializePayload.amount,
          currency: initializePayload.currency,
          email: initializePayload.email,
          tx_ref: initializePayload.tx_ref,
          phone_number: initializePayload.phone_number,
          return_url: initializePayload.return_url,
          callback_url: initializePayload.callback_url,
        });
        
        response = await ChapaService.initialize(initializePayload);
      } else {
        // Direct charge for mobile money (Telebirr, M-Pesa, etc)
        // Ensure mobile number format for Chapa (09... or 07...)
        let chapaMobile = phoneNumber.replace(/^\+/, "");
        if (chapaMobile.startsWith("251")) {
          chapaMobile = "0" + chapaMobile.substring(3);
        }

        console.log(`[CHAPA-INIT] Using DIRECT CHARGE for mobile money. Method: ${method}, Type: ${chapaType}, Currency: ${currency}`);
        
        response = await ChapaService.directCharge({
          amount: String(verifiedAmount),
          currency: currency, // Pass currency (directCharge will force to ETB)
          mobile: chapaMobile,
          type: chapaType,
          email: user ? user.email : "guest@example.com",
          first_name: ticketDetails.fullName.split(" ")[0],
          last_name: ticketDetails.fullName.split(" ")[1] || "User",
          tx_ref: transactionId,
          callback_url: chapaCallbackUrl,
          return_url: returnUrl,
          customization: {
            title: reason.substring(0, 16), // Chapa enforces max 16 chars
            description: "Ticket Purchase",
          },
        });
      }
    } catch (error) {
      // Extract actual error message from Chapa SDK error
      let errorMessage = "Payment initiation failed";
      let errorDetails = {};
      
      if (error.message && error.message !== "[object Object]") {
        errorMessage = error.message;
      }
      
      if (error.data) {
        errorDetails = error.data;
        if (error.data.message) {
          errorMessage = error.data.message;
        }
      }
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      console.error(`[CHAPA-INIT] ❌ Detailed payment error:`, {
        errorMessage,
        errorStatus: error.status,
        method: method,
        chapaType: chapaType,
        useWebCheckout: useWebCheckout,
        currency: currency,
        errorDetails,
        errorCode: error.code,
      });

      await releaseStockHold();

      return res.status(400).json({
        success: false,
        error: errorMessage,
        details: errorDetails,
      });
    }

    if (response.status !== "success") {
      console.error(`[CHAPA-INIT] ❌ Chapa returned non-success status:`, {
        status: response.status,
        message: response.message,
        data: response.data,
      });
      await releaseStockHold();
      return res.status(400).json({
        success: false,
        error: response.message || "Payment initiation failed",
      });
    }

    console.log(`[CHAPA-INIT] ✅ Chapa payment successful:`, {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : [],
      checkoutUrl: response.data?.checkout_url ? "present" : "NOT FOUND",
    });

    let checkoutUrl = null;
    // Web checkout returns checkout_url, direct charge might too or just success
    if (
      response.status === "success" &&
      response.data &&
      response.data.checkout_url
    ) {
      checkoutUrl = response.data.checkout_url;
      console.log(`[CHAPA-INIT] ✅ Got checkout URL from Chapa`);
    } else if (response.status === "success" && useWebCheckout) {
      console.warn(`[CHAPA-INIT] ⚠️ Web checkout succeeded but no checkout_url found. Response:`, response);
    }

    console.log("Chapa payment initiated:", response);

    // Save Payment Record
    // For logged-in users: use account phone for SMS, store payment phone separately
    // For guest users: use payment phone for account creation and SMS
    try {
      await Payment.create({
        transactionId: transactionId,
        status: "PENDING",
        guestName: user ? user.firstName : ticketDetails.fullName,
        contact: user && user.phoneNumber ? user.phoneNumber : phoneNumber,
        paymentPhone: phoneNumber,
        method: method,
        provider: giftCardTarget ? "chapa_giftcard" : "chapa",
        giftCardNumber: giftCardTarget || undefined,
        giftCardLinkReference: giftCardLinkReference || undefined,
        price: verifiedAmount,
        currency: currency, // Store currency in payment record
        eventId: selectedEventId,
        ticketTypeId: pricing.ticketType._id,
        stockHeldAt,
        userId: userId,
        ticketDetails: {
          ...ticketDetails,
          eventId: selectedEventId,
          ticketType: ticketDetails.ticketTypeId,
          ticketCount: ticketDetails.quantity,
          userId: userId,
          email: ticketDetails.email ? ticketDetails.email.toLowerCase() : undefined,
        },
      });
    } catch (error) {
      // Chapa already has our money moving/reserved at this point, but the
      // Payment record itself failed to write — give the stock back rather
      // than stranding it for 15 minutes until the expiry sweep gets to it.
      await releaseStockHold();
      throw error;
    }

    // Return response matching SantimPay shape
    res.json({
      success: true,
      transactionId: transactionId,
      checkoutUrl: checkoutUrl,
      message: "Redirecting to payment...",
      ...(req.guestCheckoutAuth
        ? { token: req.guestCheckoutAuth.token, user: req.guestCheckoutAuth.user }
        : {}),
    });
  } catch (err) {
    console.error("Error initiating Chapa payment:", err);
    res.status(500).json({ success: false, error: "Could not start payment" });
  }
};

// Safe route: mobile app and any already-signed-in caller. Sign-in required.
router.post("/ticket/initiate/chapa", authenticateUser, initiateChapaTicket);
// Web-only route: lets an anonymous ticket buyer log in or create an account
// inline, gated by ACTIVATE_PASSWORDLESS_ROUTE (see webCheckoutAuth above).
router.post("/ticket/initiate/chapa/web", webCheckoutAuth, initiateChapaTicket);

router.get(
  "/event/:eventId",
  authenticateUser,
  restrictTo("admin", "organizer", "partner"),
  getEventTickets
);
router.get("/invitation/:ticketId", getInvitationTicket);
router.patch("/invitation/:ticketId/status", updateInvitationTicketStatus);
router.post("/rsvp/:ticketId/confirm", confirmRSVP);
router.get("/public/details/:id", getPublicTicketDetails);

// Ticket QR image, rendered on demand rather than stored on the document.
//
// Public on purpose: it sits alongside /public/details/:id and the public
// /ticket/[ticketId] page, and follows the same capability-URL model — the
// ticketId is an unguessable UUID and is the only thing protecting it. The
// image carries no more than that page already shows.
router.get("/:ticketId/qr.:ext(svg|png)", getTicketQr);

router.post("/payment/cancel", cancelPaymentIntent);
router.patch(
  "/:ticketId/check-in",
  protect,
  restrictTo("admin", "organizer", "partner", "usher"),
  checkInTicket
);
router.post(
  "/validate-qr",
  protect,
  restrictTo("admin", "organizer", "partner", "usher"),
  validateQRCode
);

// All other routes use authentication
router.use(authenticateUser);

// Protected routes
router.get("/my-tickets-debug", async (req, res) => {
  try {
    const User = require("../models/User");
    const Ticket = require("../models/Ticket");
    
    console.log("[DEBUG] req.user:", req.user);
    const user = await User.findById(req.user.userId);
    console.log("[DEBUG] User found:", user ? user._id : "NOT FOUND");
    console.log("[DEBUG] User tickets array:", user?.tickets);
    
    if (user?.tickets?.length > 0) {
      const firstTicket = await Ticket.findById(user.tickets[0]);
      console.log("[DEBUG] First ticket:", firstTicket);
    }
    
    res.json({
      authenticated: !!req.user,
      userId: req.user?.userId,
      userExists: !!user,
      ticketsInArray: user?.tickets?.length || 0,
      ticketIds: user?.tickets || [],
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

router.post("/", createTicket);
router.post("/on-door", createOnDoorTicket);
router.post("/invite", createInvitationTicket);
router.post("/guest-ticket", createGuestTicket);
router.post("/guest-ticket/send", sendGuestInvitation);
router.get("/my-tickets", getUserTickets);
router.get("/transferable", getTransferableTickets);
router.get("/organizer/all", getOrganizerTickets);
router.get("/details/:id", getTicketDetails);
router.get("/:ticketId", getTicket);
router.patch("/:ticketId/cancel", cancelTicket);
router.delete("/:ticketId", deleteTicket);
router.get("/admin/all", restrictTo("admin"), getAllTicketsAdmin);

module.exports = router;
