const { v4: uuidv4 } = require("uuid");
const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
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

const resolveWebhookBaseUrl = () =>
  process.env.BACKEND_URL || "https://pazimoapp.testserveret.com";

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

    const provider = req.body.provider === "chapa" ? "chapa" : "santim";

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

    const notifyUrl = `${resolveWebhookBaseUrl()}/api/payment/santimpay/webhook`;
    let checkoutUrl = null;

    if (provider === "chapa") {
      const response = await ChapaService.initialize({
        amount: order.total,
        currency: order.currency,
        tx_ref: transactionId,
        email: customerEmail || undefined,
        first_name: customerName || "Customer",
        phone_number: phoneNumber,
        callback_url: `${resolveWebhookBaseUrl()}/api/webhooks/chapa`,
      });
      checkoutUrl = response?.data?.checkout_url || null;
      if (!checkoutUrl) {
        throw new BadRequestError(response?.message || "Payment could not be started");
      }
    } else {
      await SantimPayService.directPayment(
        transactionId,
        order.total,
        `Cinema tickets — ${order.movieTitle || "screening"}`,
        notifyUrl,
        phoneNumber,
        req.body.paymentMethod || "Telebirr"
      );
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        transactionId,
        checkoutUrl,
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
    res.status(status).json({ success: false, message: error.message });
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
  getShowtimeSeats,
  quoteCheckout,
  startCheckout,
  settleCinemaPayment,
  getOrder,
};
