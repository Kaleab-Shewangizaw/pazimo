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
    let checkoutUrl = null;

    if (provider === "chapa") {
      // Where the customer lands after paying. Their order — with every
      // ticket's QR and the snacks to collect — rather than a generic success
      // page, because the QR is the thing they came for.
      const frontendUrl = (
        process.env.FRONTEND_URL ||
        req.body.origin ||
        "http://localhost:3000"
      ).replace(/\/$/, "");

      // The payload Chapa actually accepts, shaped exactly as the event
      // checkout shapes it. Each of these is a rejection Chapa returns as an
      // opaque validation error rather than an explanation:
      //   amount must be a STRING
      //   phone_number must be 09…/07… — 10 digits, no +251, omitted entirely
      //     for an international number rather than sent in a rejected format
      //   customization.title is capped at 16 characters
      //   email is required, so a guest checkout needs a stand-in
      let chapaPhone = null;
      if (phoneNumber) {
        let stripped = String(phoneNumber).replace(/[\s+]/g, "");
        if (stripped.startsWith("251")) stripped = `0${stripped.substring(3)}`;
        if (stripped.startsWith("09") || stripped.startsWith("07")) {
          chapaPhone = stripped;
        }
      }

      const [firstName, ...restOfName] = String(customerName || "Cinema Guest")
        .trim()
        .split(/\s+/);

      const response = await ChapaService.initialize({
        amount: String(order.total),
        currency: order.currency,
        tx_ref: transactionId,
        email: customerEmail || "guest@example.com",
        first_name: firstName || "Cinema",
        last_name: restOfName.join(" ") || "Guest",
        ...(chapaPhone && { phone_number: chapaPhone }),
        callback_url: `${webhookBaseUrl}/api/webhooks/chapa`,
        return_url: `${frontendUrl}/cinema/order/${transactionId}`,
        customization: {
          title: "Cinema tickets",
          description: (order.movieTitle || "Screening").substring(0, 50),
        },
      });
      checkoutUrl = response?.data?.checkout_url || null;
      if (!checkoutUrl) {
        throw new BadRequestError(
          describePaymentError(response) || "Payment could not be started"
        );
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

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        transactionId,
        checkoutUrl,
        // So the client knows whether to redirect (Chapa) or to poll while the
        // customer approves a prompt on their phone (SantimPay).
        provider,
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

    const tickets = await CinemaTicket.find({ paymentReference: transactionId })
      .populate("movie", "title poster")
      .populate("cinema", "name address city")
      .select(
        "ticketId movieTitle hallName showtimeStartsAt ticketType price quantity totalAmount currency seat status paymentStatus purchaseDate movie cinema"
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
  settleCinemaPayment,
  getOrder,
};
