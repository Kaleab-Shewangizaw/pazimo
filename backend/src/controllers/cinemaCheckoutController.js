const { v4: uuidv4 } = require("uuid");
const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const CinemaTicket = require("../models/CinemaTicket");
const checkoutService = require("../services/cinemaCheckoutService");
const settlementService = require("../services/cinemaSettlementService");
const seatService = require("../services/cinemaSeatService");
const SantimPayService = require("../services/santimPayService");
const ChapaService = require("../services/chapaService");
const ChapaGiftCardService = require("../services/chapaGiftCardService");
const { BadRequestError, NotFoundError } = require("../errors");

// Buying a cinema ticket online.
//
// The flow, and why it is split the way it is:
//
//   GET  /public/showtimes/:id/seats   what the room looks like and what is free
//   POST /public/checkout/quote        what a basket would cost — reserves nothing
//   POST /public/checkout              locks the seats and starts a payment
//   (webhook)                          issues the tickets and the snacks
//
// The quote step exists so browsing does not take locks. A customer opening the
// snacks tab, changing their mind, and going back to the seat picker must not
// have been sitting on the best seats in the house the whole time.
//
// The price is decided here and nowhere else. A `total` arriving in a request
// body is never read — see cinemaCheckoutService.

/**
 * The base URL a payment provider can actually reach us on.
 *
 * Copied in behaviour from ticketRoutes rather than simplified: a webhook URL
 * that resolves to localhost is accepted by the provider and then never called,
 * so the payment succeeds and the order never settles — the worst possible
 * failure, because the customer has paid.
 */
const resolveWebhookBaseUrl = (req) => {
  const explicitPublicUrl =
    process.env.CHAPA_WEBHOOK_BASE_URL || process.env.BACKEND_PUBLIC_URL;
  if (explicitPublicUrl) return explicitPublicUrl.replace(/\/$/, "");

  const configuredBackendUrl = process.env.BACKEND_URL;
  if (configuredBackendUrl && !/localhost|127\.0\.0\.1/i.test(configuredBackendUrl)) {
    return configuredBackendUrl.replace(/\/$/, "");
  }

  const forwardedHost = req?.headers?.["x-forwarded-host"];
  if (forwardedHost && !/localhost|127\.0\.0\.1/i.test(forwardedHost)) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    return `${protocol}://${forwardedHost}`.replace(/\/$/, "");
  }

  return (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
};

/**
 * Turn whatever a payment provider threw into a sentence a customer can read.
 *
 * Chapa reports validation failures as an OBJECT keyed by field
 * ({ email: ["validation.email"] }), and SantimPay as { reason }. Passing
 * either straight through produces the literal string "[object Object]" on the
 * checkout page — which is what this endpoint was doing, and which tells a
 * customer nothing and a developer almost nothing.
 */
const describePaymentError = (error) => {
  if (!error) return null;
  if (typeof error === "string") return error;

  // Candidates in order of usefulness. `error.message` is checked but NOT
  // trusted: when Chapa's message is an object, `new Error(obj)` stringifies it
  // to the literal "[object Object]", which is a non-empty string and would
  // therefore win any ?? chain while carrying no information at all. Each
  // candidate is judged on what it says, not on merely existing.
  const candidates = [
    error.message,
    error.data?.message,
    error.response?.data?.message,
    error.reason,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const text = candidate.trim();
      if (text && text !== "[object Object]") return text;
      continue;
    }
    // { email: ["validation.email"], amount: [...] } -> "email: validation.email"
    if (candidate && typeof candidate === "object") {
      const parts = Object.entries(candidate).map(
        ([field, detail]) =>
          `${field}: ${Array.isArray(detail) ? detail.join(", ") : detail}`
      );
      if (parts.length) {
        return `The payment provider rejected the request (${parts.join("; ")})`;
      }
    }
  }

  return null;
};

/**
 * Map the method a customer picked onto what Chapa calls it.
 *
 * Two very different flows hide behind this:
 *
 *   MOBILE MONEY (telebirr, M-Pesa, CBE, Awash) is a DIRECT CHARGE. Chapa
 *   pushes a prompt to the customer's phone and the browser never leaves the
 *   site — so there is no URL to redirect to, and the page has to poll.
 *
 *   CARDS (Visa, Mastercard) need Chapa's hosted page, because card entry and
 *   3-D Secure cannot happen on our form.
 *
 * Treating a mobile-money payment as a redirect leaves the customer staring at
 * a checkout page for a charge already sitting on their phone — which is what
 * this replaces.
 */
const resolveChapaMethod = (method) => {
  const input = String(method || "").toLowerCase().trim();

  if (input === "visa" || input === "mastercard" || input === "card") {
    // Web checkout handles every card type, so it needs no specific type.
    return { useWebCheckout: true, chapaType: null };
  }
  if (input === "mpesa") return { useWebCheckout: false, chapaType: "mpesa" };
  if (input === "telebirr") return { useWebCheckout: false, chapaType: "telebirr" };
  if (input.includes("cbe")) return { useWebCheckout: false, chapaType: "cbebirr" };
  if (input.includes("awash")) return { useWebCheckout: false, chapaType: "awashbirr" };
  if (input === "amole") return { useWebCheckout: false, chapaType: "Amole" };
  if (input.includes("boa") || input.includes("abyssinia")) {
    return { useWebCheckout: false, chapaType: "boa_ussd" };
  }
  // Same default the event checkout uses for an unrecognised method.
  return { useWebCheckout: false, chapaType: "telebirr" };
};

/** Chapa wants 09…/07…, never +251… — used for both charge shapes. */
const toEthiopianMobile = (phone) => {
  let mobile = String(phone || "").replace(/[\s+]/g, "");
  if (mobile.startsWith("251")) mobile = `0${mobile.substring(3)}`;
  return mobile;
};

/** The seat map for a screening, with what is already taken. */
const getShowtimeSeats = async (req, res) => {
  try {
    const map = await seatService.getSeatMapForShowtime(req.params.showtimeId);
    res.status(StatusCodes.OK).json({ success: true, data: map });
  } catch (error) {
    console.error("Error building seat map:", error);
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ success: false, message: error.message });
  }
};

/** What a basket would cost. Reserves nothing. */
const quoteCheckout = async (req, res) => {
  try {
    const basket = await checkoutService.priceBasket({
      showtimeId: req.body.showtime,
      seatKeys: req.body.seats,
      ticketTypeId: req.body.ticketType,
      quantity: req.body.quantity,
      concessions: req.body.concessions,
    });
    res.status(StatusCodes.OK).json({ success: true, data: basket });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error quoting cinema basket:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Lock the seats and start a payment.
 *
 * Order matters: seats are held BEFORE the provider is called, so a customer
 * who reaches a payment page is holding the chairs they are paying for. If the
 * provider then refuses, the hold is released immediately rather than left to
 * expire — ten minutes of a dead lock on a sold-out screening is ten minutes of
 * seats nobody can buy.
 */
const startCheckout = async (req, res) => {
  const transactionId = `CIN-${uuidv4()}`;
  let order = null;

  try {
    const { phoneNumber, customerName, customerEmail } = req.body;
    if (!phoneNumber) {
      throw new BadRequestError("A phone number is required to pay");
    }

    order = await checkoutService.startCheckout({
      showtimeId: req.body.showtime,
      seatKeys: req.body.seats,
      ticketTypeId: req.body.ticketType,
      quantity: req.body.quantity,
      concessions: req.body.concessions,
      // The seats are held under the transaction id, so settlement and failure
      // both have one key that ties the money to the chairs.
      reference: transactionId,
    });

    // WHICH PROVIDER, decided the way the event checkout decides it.
    //
    // The platform picks one in Admin → Payment config; a cinema order must not
    // hardcode a different one, or turning SantimPay off for maintenance would
    // leave cinema checkout the only surface still calling it — which is exactly
    // the "service is currently unavailable" failure this replaces.
    //
    // USD forces Chapa regardless: SantimPay settles Ethiopian mobile money and
    // has no path for an international card.
    const paymentConfig = await PaymentConfig.findOne();
    const activeProvider =
      order.currency === "USD" ? "CHAPA" : paymentConfig?.activeProvider || "SANTIM";
    const provider = activeProvider === "CHAPA" ? "chapa" : "santim";

    // WHICH METHOD the customer picked — Telebirr, CBE Birr, M-Pesa, a card.
    // Required rather than defaulted: silently sending "Telebirr" for someone
    // who chose M-Pesa produces a payment prompt on a wallet they do not have,
    // and the failure looks like a platform outage rather than a wrong choice.
    const method = String(req.body.method || "").trim();
    if (!method) {
      throw new BadRequestError("Choose how you want to pay");
    }

    await Payment.create({
      transactionId,
      status: "PENDING",
      // What routes settlement. Without it this would be settled as an event.
      salesContext: "CINEMA",
      provider,
      guestName: customerName,
      contact: phoneNumber,
      paymentPhone: phoneNumber,
      // Read by the status poller to tell a direct charge from a web checkout:
      // a direct charge is not worth retrying inside one request, because Chapa
      // cannot resolve a prompt sitting on someone's phone in under a second.
      method,
      price: order.total,
      currency: order.currency,
      userId: req.user?.userId || undefined,
      // The priced basket, stored verbatim.
      //
      // Settlement does NOT re-price: the customer has already been charged
      // this total, so re-deriving it later could only produce a figure that
      // disagrees with the money actually taken.
      ticketDetails: {
        cinemaOrder: order,
        customerName,
        customerEmail,
        customerPhone: phoneNumber,
      },
    });

    const webhookBaseUrl = resolveWebhookBaseUrl(req);
    const reason = `Cinema tickets — ${order.movieTitle || "screening"}`;
    // Null for a direct charge, which never leaves the site. Its presence is
    // what tells the client to redirect rather than poll.
    let checkoutUrl = null;
    // Set only when the payment is routed into a Chapa Link gift card — the
    // poller verifies those through the Link reference rather than through
    // Chapa's transaction API, so both have to be recorded on the Payment.
    let giftCardLinkReference = null;
    let giftCardNumber = null;
    let settledProvider = provider;

    if (provider === "chapa") {
      const { useWebCheckout, chapaType } = resolveChapaMethod(method);
      const chapaMobile = toEthiopianMobile(phoneNumber);

      // Where the customer lands after a HOSTED payment. Their order — every
      // ticket's QR and the snacks to collect — rather than a generic success
      // page, because the QR is what they came for. Unused by a direct charge,
      // which never leaves the site.
      const frontendUrl = (
        process.env.FRONTEND_URL ||
        req.body.origin ||
        "http://localhost:3000"
      ).replace(/\/$/, "");
      const returnUrl = `${frontendUrl}/cinema/order/${transactionId}`;

      const [firstName, ...restOfName] = String(customerName || "Cinema Guest")
        .trim()
        .split(/\s+/);

      // Each of these is a rejection Chapa returns as an opaque validation
      // error rather than an explanation: amount must be a STRING, phone must
      // be 09…/07…, title is capped at 16 characters, and email is required so
      // a guest checkout needs a stand-in.
      const common = {
        amount: String(order.total),
        currency: order.currency,
        email: customerEmail || "guest@example.com",
        first_name: firstName || "Cinema",
        last_name: restOfName.join(" ") || "Guest",
        tx_ref: transactionId,
        callback_url: `${webhookBaseUrl}/api/webhooks/chapa`,
        return_url: returnUrl,
        customization: {
          title: "Cinema tickets",
          description: (order.movieTitle || "Screening").substring(0, 50),
        },
      };

      // Gift-card routing, cinema's own switch.
      //
      // Independent of the event ticket toggle (giftCardMode/giftCardRouting):
      // a cinema's takings route to their own dedicated card so cinema money
      // and event ticket money never land in the same card's transaction
      // history. Toggled from Admin → Cinema → Money; the card itself is
      // picked in Admin → Finance → Gift Cards.
      const giftCardTarget = paymentConfig?.cinemaGiftCardMode
        ? paymentConfig.cinemaGiftCardRouting?.[order.currency]
        : null;

      if (paymentConfig?.cinemaGiftCardMode && !giftCardTarget) {
        throw new BadRequestError(
          `Gift card routing is on but no ${order.currency} cinema card is configured. Set one in Admin → Finance.`
        );
      }

      if (giftCardTarget) {
        // The Link API works in cents.
        const cents = Math.round(order.total * 100);
        if (useWebCheckout) {
          const result = await ChapaGiftCardService.topUpHosted({
            card_number: giftCardTarget,
            amount: cents,
            merchant_reference: transactionId,
          });
          checkoutUrl = result?.checkout_url || null;
          giftCardLinkReference = result?.link_reference || null;
        } else {
          const result = await ChapaGiftCardService.topUpDirectCharge({
            card_number: giftCardTarget,
            amount: cents,
            phone_number: chapaMobile,
            payment_method: chapaType,
            merchant_reference: transactionId,
          });
          giftCardLinkReference = result?.link_reference || null;
        }
        // The poller verifies a gift-card payment through the Link reference,
        // not through Chapa's transaction API, so the provider has to say so.
        settledProvider = "chapa_giftcard";
        giftCardNumber = giftCardTarget;
      } else if (useWebCheckout) {
        const response = await ChapaService.initialize({
          ...common,
          ...(/^0[79]/.test(chapaMobile) && { phone_number: chapaMobile }),
        });
        checkoutUrl = response?.data?.checkout_url || null;
        if (!checkoutUrl) {
          throw new BadRequestError(
            describePaymentError(response) || "Payment could not be started"
          );
        }
      } else {
        // DIRECT CHARGE. Chapa pushes a prompt to the phone; nothing to
        // redirect to, so checkoutUrl stays null and the client polls.
        await ChapaService.directCharge({
          ...common,
          mobile: chapaMobile,
          type: chapaType,
        });
      }
    } else {
      // The route SantimPay actually calls back on. This previously pointed at
      // /api/payment/santimpay/webhook, which does not exist — a paid order
      // would never have settled.
      const notifyUrl = `${webhookBaseUrl}/api/webhook/santimpay`;
      await SantimPayService.directPayment(
        transactionId,
        order.total,
        reason,
        notifyUrl,
        phoneNumber,
        method
      );
    }

    // Record what the payment actually became.
    //
    // The row is created PENDING before the provider is called, so a charge can
    // never exist without a record of it. What the provider turns out to be —
    // and, in gift-card mode, which card and which Link reference — is only
    // known afterwards, and the poller needs all three to verify it.
    if (
      settledProvider !== provider ||
      giftCardLinkReference ||
      giftCardNumber
    ) {
      await Payment.updateOne(
        { transactionId },
        {
          $set: {
            provider: settledProvider,
            ...(giftCardNumber && { giftCardNumber }),
            ...(giftCardLinkReference && { giftCardLinkReference }),
          },
        }
      );
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        transactionId,
        checkoutUrl,
        provider: settledProvider,
        // What the client should DO next, rather than making it infer that
        // from the provider name and the presence of a URL.
        //   "redirect" — send the customer to checkoutUrl (cards)
        //   "prompt"   — a charge is on their phone; poll until it settles
        //                (mobile money, and every SantimPay payment)
        action: checkoutUrl ? "redirect" : "prompt",
        total: order.total,
        currency: order.currency,
        // So the page can show a countdown rather than failing silently when
        // the hold lapses.
        expiresAt: order.expiresAt,
        seats: order.tickets.filter((t) => t.seatKey).map((t) => t.seatKey),
      },
    });
  } catch (error) {
    // Hand the seats straight back. Waiting for the TTL would leave chairs
    // locked for ten minutes because a provider was briefly unreachable.
    if (order) {
      await seatService.releaseHolds(transactionId).catch(() => {});
      await Payment.updateOne(
        { transactionId, status: "PENDING" },
        { $set: { status: "FAILED" } }
      ).catch(() => {});
    }
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error starting cinema checkout:", error);

    // A provider being unreachable is not the customer's fault and not a bug in
    // their basket, so it reads as a payment problem they can retry rather than
    // as a raw SDK object.
    const described = describePaymentError(error);
    res.status(status).json({
      success: false,
      message:
        status >= 500
          ? described || "Payment could not be started. Please try again."
          : described || error.message,
    });
  }
};

/**
 * Settle a paid cinema order. Called by processSuccessfulPayment, which every
 * webhook and poller already funnels through.
 *
 * Returns the first ticket so the existing callers — which expect a ticket-ish
 * object back and read `.ticketId` off it for their response — keep working
 * unchanged.
 */
const settleCinemaPayment = async (payment) => {
  if (payment.status !== "PAID") return null;

  const order = payment.ticketDetails?.cinemaOrder;
  if (!order) {
    console.error(
      `[CINEMA-SETTLE] payment ${payment.transactionId} is marked CINEMA but carries no order`
    );
    return null;
  }

  const details = payment.ticketDetails || {};
  const result = await settlementService.settleCinemaOrder({
    order,
    reference: payment.transactionId,
    customer: payment.userId || undefined,
    customerName: details.customerName || payment.guestName,
    customerPhone: details.customerPhone || payment.contact,
    customerEmail: details.customerEmail,
  });

  return result.tickets[0] || null;
};

/**
 * Give up on an order and hand the seats straight back.
 *
 * WHY THIS EXISTS
 *
 * Seats are locked when a customer reaches the payment step and released by a
 * TTL ten minutes later. That TTL is the safety net for a browser closed
 * mid-payment — it is not an acceptable answer for someone who pressed Back,
 * because on a busy screening it means ten minutes where the best seats in the
 * house are unbuyable and nothing on the page explains why.
 *
 * Deliberately public and unauthenticated, like the rest of the checkout: a
 * guest has no account, and the transaction id is the only thing tying them to
 * the order. That id is a v4 UUID, so it is not guessable — but the real guard
 * is below: a PAID order is never cancelled here, so the worst a leaked id can
 * do is release seats nobody has paid for yet, which the TTL was about to do
 * anyway.
 */
const cancelCheckout = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({
      transactionId,
      salesContext: "CINEMA",
    });
    if (!payment) throw new NotFoundError("Order not found");

    // A paid order is not cancellable by walking back to the page. The money
    // moved; releasing the chair now would resell a seat someone owns, and
    // undoing a settled sale is a refund, which returns money as well as a seat.
    if (payment.status === "PAID") {
      throw new BadRequestError(
        "This order has already been paid for. Contact the cinema for a refund."
      );
    }

    const released = await seatService.releaseHolds(transactionId);

    // Only a still-pending payment is marked cancelled. One that already
    // FAILED keeps that status: how it ended is more informative than the fact
    // that someone later looked at it.
    if (payment.status === "PENDING") {
      payment.status = "CANCELLED";
      await payment.save();
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: { transactionId, released, status: payment.status },
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error cancelling cinema checkout:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Everything one paid order produced — the tickets and the snacks.
 *
 * This is what the success page reads. Keyed by transaction id rather than by
 * ticket id because an order can be several tickets, and the customer arriving
 * back from a payment redirect knows only the transaction.
 */
const getOrder = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({
      transactionId,
      salesContext: "CINEMA",
    }).lean();
    if (!payment) throw new NotFoundError("Order not found");

    // A payment that will never settle should not go on holding chairs.
    //
    // The TTL would free them within ten minutes anyway, but on a busy screening
    // ten minutes of dead locks on the best seats is real: nobody else can book
    // them and nothing visibly explains why. Reading the failed order is the
    // moment we know for certain, so it is the moment to let go.
    //
    // Only ever releases holds still marked `held` — a sold seat belongs to a
    // paid customer and is not this function's to touch.
    if (["FAILED", "CANCELLED"].includes(payment.status)) {
      await seatService.releaseHolds(transactionId).catch((error) =>
        console.error(
          `[CINEMA] could not release seats for failed order ${transactionId}: ${error.message}`
        )
      );
    }

    const tickets = await CinemaTicket.find({ paymentReference: transactionId })
      .populate("movie", "title poster")
      .populate("cinema", "name address city")
      .select(
        "ticketId movieTitle hallName showtimeStartsAt ticketType price quantity totalAmount currency seats status paymentStatus purchaseDate movie cinema"
      )
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        transactionId,
        status: payment.status,
        total: payment.price,
        currency: payment.currency,
        tickets,
        // Straight off the stored basket: the snacks were paid for as part of
        // this order and the customer needs to see them on the same page.
        concessions: payment.ticketDetails?.cinemaOrder?.concessions || [],
      },
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error reading cinema order:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = {
  // Exported for testing: turning provider errors into readable text is easy to
  // get subtly wrong (see the "[object Object]" note above) and is worth
  // asserting rather than eyeballing.
  describePaymentError,
  getShowtimeSeats,
  quoteCheckout,
  startCheckout,
  cancelCheckout,
  settleCinemaPayment,
  getOrder,
};
