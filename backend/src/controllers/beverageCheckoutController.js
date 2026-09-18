const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const { StatusCodes } = require("http-status-codes");
const Payment = require("../models/Payment");
const PaymentConfig = require("../models/PaymentConfig");
const Event = require("../models/Event");
const Venue = require("../models/Venue");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const BeverageSale = require("../models/BeverageSale");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const concessionBasketService = require("../services/concessionBasketService");
const ChapaService = require("../services/chapaService");
const ChapaGiftCardService = require("../services/chapaGiftCardService");
const { renderBarcodePng } = require("../utils/barcodeRenderer");
const {
  resolveWebhookBaseUrl,
  describePaymentError,
  resolveChapaMethod,
  toEthiopianMobile,
} = require("../utils/chapaCheckoutHelpers");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");

// Paying for drinks — the mobile app's "refill" purchase.
//
// This is a purchase SEPARATE from buying a ticket, not a basket bundled into
// ticket checkout (that is a different, still-unwired feature — see
// concessionBasketService.js's own comments and docs/PAZIMO_PLAN.md's B2). An
// event customer must already hold a valid, paid ticket; a venue customer
// just needs an account — same gates browsing already uses in
// beverageController.js/venueController.js's refill routes.
//
// Chapa only, always — the platform's activeProvider/SantimPay toggle
// (which every other checkout in this codebase respects) is deliberately
// never consulted here.
//
// The flow, one endpoint pair per channel:
//   POST .../checkout/quote   what a basket would cost — reserves nothing
//   POST .../checkout         starts a payment
//   (webhook/poller)          settles into BeverageSale / VenueBeverageSale
//
// No stock hold/TTL is needed the way cinema's seat picker needs one:
// concessionBasketService.fulfilBasket's atomic stock claim at settlement is
// the only guarantee a bottle isn't oversold, exactly as it already is for
// the (currently unused) bundled-checkout path.

// A ticket that actually admits its holder — the same filter
// beverageController.js's refill-catalog route gates browsing on. Kept as its
// own copy rather than imported, the way cinemaCheckoutController's helpers
// are copied rather than shared: four fields, and importing it would couple
// this file to another controller module for a constant.
const VALID_TICKET_FILTER = {
  status: "active",
  paymentStatus: "completed",
  ticketCount: { $gt: 0 },
};

const requireEventTicketHolder = async (eventId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw new NotFoundError("Event not found");
  }
  const event = await Event.findById(eventId).select("_id title organizer");
  if (!event) throw new NotFoundError("Event not found");

  const hasValidTicket = await Ticket.exists({
    event: eventId,
    user: userId,
    ...VALID_TICKET_FILTER,
  });
  if (!hasValidTicket) {
    throw new ForbiddenError("You need a ticket to this event to buy drinks here");
  }
  return event;
};

const requireEligibleVenue = async (venueId) => {
  if (!mongoose.Types.ObjectId.isValid(venueId)) {
    throw new NotFoundError("Venue not found");
  }
  const venue = await Venue.findById(venueId).select("_id name isActive eligibility");
  if (!venue || !venue.isActive || venue.eligibility !== "eligible") {
    throw new NotFoundError("Venue not found");
  }
  return venue;
};

/** The signed-in customer's own contact details, as a fallback for the body. */
const resolveCustomerContact = async (req) => {
  const user = await User.findById(req.user.userId).select(
    "firstName lastName email phoneNumber"
  );
  const customerName =
    (req.body.customerName || `${user?.firstName || ""} ${user?.lastName || ""}`).trim() ||
    "Pazimo Customer";
  const customerEmail = req.body.customerEmail || user?.email || "guest@example.com";
  const phoneNumber = req.body.phoneNumber || user?.phoneNumber;
  if (!phoneNumber) throw new BadRequestError("A phone number is required to pay");
  return { customerName, customerEmail, phoneNumber };
};

/**
 * Start a Chapa payment for an already-priced basket. Shared by both
 * channels: everything about talking to Chapa is identical, and only what
 * gets stored on the Payment (and which PaymentConfig fields gate gift-card
 * routing) differs.
 */
const chargeBasket = async ({
  req,
  transactionId,
  total,
  currency,
  customerName,
  customerEmail,
  phoneNumber,
  title,
  description,
  giftCardMode,
  giftCardRouting,
  returnPath,
}) => {
  const webhookBaseUrl = resolveWebhookBaseUrl(req);
  const method = String(req.body.method || "").trim();
  if (!method) throw new BadRequestError("Choose how you want to pay");

  const { useWebCheckout, chapaType } = resolveChapaMethod(method);
  const chapaMobile = toEthiopianMobile(phoneNumber);

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    req.body.origin ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const returnUrl = `${frontendUrl}${returnPath}`;

  const [firstName, ...restOfName] = customerName.split(/\s+/);

  const common = {
    amount: String(total),
    currency,
    email: customerEmail,
    first_name: firstName || "Pazimo",
    last_name: restOfName.join(" ") || "Customer",
    tx_ref: transactionId,
    callback_url: `${webhookBaseUrl}/api/webhooks/chapa`,
    return_url: returnUrl,
    customization: { title, description: String(description).substring(0, 50) },
  };

  const giftCardTarget = giftCardMode ? giftCardRouting?.[currency] : null;
  if (giftCardMode && !giftCardTarget) {
    throw new BadRequestError(
      `Gift card routing is on but no ${currency} card is configured for this channel. Set one in Admin → Finance.`
    );
  }

  let checkoutUrl = null;
  let giftCardLinkReference = null;
  let giftCardNumber = null;
  let settledProvider = "chapa";

  if (giftCardTarget) {
    // The Link API works in cents.
    const cents = Math.round(total * 100);
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
    // DIRECT CHARGE. Chapa pushes a prompt to the phone; nothing to redirect
    // to, so checkoutUrl stays null and the client polls.
    await ChapaService.directCharge({ ...common, mobile: chapaMobile, type: chapaType });
  }

  if (settledProvider !== "chapa" || giftCardLinkReference || giftCardNumber) {
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

  return { checkoutUrl, settledProvider };
};

// ---------------------------------------------------------------------------
// Event channel
// ---------------------------------------------------------------------------

const quoteEventRefillCheckout = async (req, res) => {
  try {
    const { eventId } = req.params;
    await requireEventTicketHolder(eventId, req.user.userId);

    const basket = await concessionBasketService.priceBasket({
      eventId,
      items: req.body.items,
    });
    if (!basket.ok) {
      return res.status(basket.statusCode || 400).json({ success: false, message: basket.message });
    }
    res.status(StatusCodes.OK).json({ success: true, data: basket });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error quoting event refill checkout:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

const startEventRefillCheckout = async (req, res) => {
  let transactionId = null;
  try {
    const { eventId } = req.params;
    const event = await requireEventTicketHolder(eventId, req.user.userId);

    const basket = await concessionBasketService.priceBasket({
      eventId,
      items: req.body.items,
    });
    if (!basket.ok) {
      return res.status(basket.statusCode || 400).json({ success: false, message: basket.message });
    }
    if (!basket.lines.length) {
      throw new BadRequestError("Your basket is empty");
    }

    const { customerName, customerEmail, phoneNumber } = await resolveCustomerContact(req);

    transactionId = `BEV-${uuidv4()}`;
    await Payment.create({
      transactionId,
      status: "PENDING",
      salesContext: "EVENT_BEVERAGE",
      provider: "chapa",
      guestName: customerName,
      contact: phoneNumber,
      paymentPhone: phoneNumber,
      method: String(req.body.method || "").trim(),
      price: basket.total,
      currency: basket.currency,
      userId: req.user.userId,
      // Settlement does NOT re-price: the customer has already been charged
      // this total, so re-deriving it later could only disagree with the
      // money actually taken. Mirrors cinemaCheckoutController's own note.
      ticketDetails: {
        eventId: event._id,
        organizerId: event.organizer,
        lines: basket.lines,
        customerName,
        customerEmail,
        customerPhone: phoneNumber,
      },
    });

    const paymentConfig = await PaymentConfig.findOne();
    const { checkoutUrl, settledProvider } = await chargeBasket({
      req,
      transactionId,
      total: basket.total,
      currency: basket.currency,
      customerName,
      customerEmail,
      phoneNumber,
      title: "Drinks",
      description: event.title || "Event drinks",
      giftCardMode: paymentConfig?.beverageGiftCardMode,
      giftCardRouting: paymentConfig?.beverageGiftCardRouting,
      returnPath: `/refill/order/${transactionId}`,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        transactionId,
        checkoutUrl,
        provider: settledProvider,
        action: checkoutUrl ? "redirect" : "prompt",
        total: basket.total,
        currency: basket.currency,
      },
    });
  } catch (error) {
    if (transactionId) {
      await Payment.updateOne(
        { transactionId, status: "PENDING" },
        { $set: { status: "FAILED" } }
      ).catch(() => {});
    }
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error starting event refill checkout:", error);
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
 * Called by processSuccessfulPayment once a Payment with
 * salesContext "EVENT_BEVERAGE" is confirmed PAID.
 */
const settleEventRefillPayment = async (payment) => {
  if (payment.status !== "PAID") return null;

  const details = payment.ticketDetails || {};
  if (!details.eventId || !Array.isArray(details.lines)) {
    console.error(
      `[BEVERAGE-SETTLE] payment ${payment.transactionId} is marked EVENT_BEVERAGE but carries no basket`
    );
    return null;
  }

  const result = await concessionBasketService.fulfilBasket({
    eventId: details.eventId,
    organizerId: details.organizerId,
    lines: details.lines,
    customer: payment.userId || undefined,
    customerName: details.customerName || payment.guestName,
    customerPhone: details.customerPhone || payment.contact,
    paymentReference: payment.transactionId,
  });

  // The buyer has already paid — a sold-out line must not throw the whole
  // fulfilment away. Logged loudly for the same reason cinema's B2 settlement
  // logs `failed`: money was taken for something not delivered, and there is
  // no refund automation yet, so this needs a human.
  if (result.failed?.length) {
    console.error(
      `[BEVERAGE-SETTLE] payment ${payment.transactionId} settled with ${result.failed.length} failed line(s):`,
      JSON.stringify(result.failed)
    );
  }

  return result.created[0] || null;
};

/** Everything one paid event-refill order produced, for the mobile order screen. */
const getEventRefillOrder = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({
      transactionId,
      salesContext: "EVENT_BEVERAGE",
    }).lean();
    if (!payment) throw new NotFoundError("Order not found");
    if (String(payment.userId || "") !== String(req.user.userId)) {
      throw new ForbiddenError("This order does not belong to you");
    }

    const sales = await BeverageSale.find({ paymentReference: transactionId })
      .select("referenceNumber beverageName quantity unitPrice totalAmount status redeemedAt soldAt")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: { transactionId, status: payment.status, total: payment.price, currency: payment.currency, sales },
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error reading event refill order:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Venue channel
// ---------------------------------------------------------------------------

const quoteVenueRefillCheckout = async (req, res) => {
  try {
    const { venueId } = req.params;
    await requireEligibleVenue(venueId);

    const basket = await concessionBasketService.priceVenueBasket({
      venueId,
      items: req.body.items,
    });
    if (!basket.ok) {
      return res.status(basket.statusCode || 400).json({ success: false, message: basket.message });
    }
    res.status(StatusCodes.OK).json({ success: true, data: basket });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error quoting venue refill checkout:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

const startVenueRefillCheckout = async (req, res) => {
  let transactionId = null;
  try {
    const { venueId } = req.params;
    const venue = await requireEligibleVenue(venueId);

    const basket = await concessionBasketService.priceVenueBasket({
      venueId,
      items: req.body.items,
    });
    if (!basket.ok) {
      return res.status(basket.statusCode || 400).json({ success: false, message: basket.message });
    }
    if (!basket.lines.length) {
      throw new BadRequestError("Your basket is empty");
    }

    const { customerName, customerEmail, phoneNumber } = await resolveCustomerContact(req);

    transactionId = `VBEV-${uuidv4()}`;
    await Payment.create({
      transactionId,
      status: "PENDING",
      salesContext: "VENUE_BEVERAGE",
      provider: "chapa",
      guestName: customerName,
      contact: phoneNumber,
      paymentPhone: phoneNumber,
      method: String(req.body.method || "").trim(),
      price: basket.total,
      currency: basket.currency,
      userId: req.user.userId,
      ticketDetails: {
        venueId: venue._id,
        lines: basket.lines,
        customerName,
        customerEmail,
        customerPhone: phoneNumber,
      },
    });

    const paymentConfig = await PaymentConfig.findOne();
    const { checkoutUrl, settledProvider } = await chargeBasket({
      req,
      transactionId,
      total: basket.total,
      currency: basket.currency,
      customerName,
      customerEmail,
      phoneNumber,
      title: "Drinks",
      description: venue.name || "Venue drinks",
      giftCardMode: paymentConfig?.venueBeverageGiftCardMode,
      giftCardRouting: paymentConfig?.venueBeverageGiftCardRouting,
      returnPath: `/refill/order/${transactionId}`,
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: {
        transactionId,
        checkoutUrl,
        provider: settledProvider,
        action: checkoutUrl ? "redirect" : "prompt",
        total: basket.total,
        currency: basket.currency,
      },
    });
  } catch (error) {
    if (transactionId) {
      await Payment.updateOne(
        { transactionId, status: "PENDING" },
        { $set: { status: "FAILED" } }
      ).catch(() => {});
    }
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error starting venue refill checkout:", error);
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
 * Called by processSuccessfulPayment once a Payment with
 * salesContext "VENUE_BEVERAGE" is confirmed PAID.
 */
const settleVenueRefillPayment = async (payment) => {
  if (payment.status !== "PAID") return null;

  const details = payment.ticketDetails || {};
  if (!details.venueId || !Array.isArray(details.lines)) {
    console.error(
      `[BEVERAGE-SETTLE] payment ${payment.transactionId} is marked VENUE_BEVERAGE but carries no basket`
    );
    return null;
  }

  const result = await concessionBasketService.fulfilVenueBasket({
    venueId: details.venueId,
    lines: details.lines,
    customer: payment.userId || undefined,
    customerName: details.customerName || payment.guestName,
    customerPhone: details.customerPhone || payment.contact,
    paymentReference: payment.transactionId,
  });

  if (result.failed?.length) {
    console.error(
      `[BEVERAGE-SETTLE] payment ${payment.transactionId} settled with ${result.failed.length} failed line(s):`,
      JSON.stringify(result.failed)
    );
  }

  return result.created[0] || null;
};

/** Everything one paid venue-refill order produced, for the mobile order screen. */
const getVenueRefillOrder = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const payment = await Payment.findOne({
      transactionId,
      salesContext: "VENUE_BEVERAGE",
    }).lean();
    if (!payment) throw new NotFoundError("Order not found");
    if (String(payment.userId || "") !== String(req.user.userId)) {
      throw new ForbiddenError("This order does not belong to you");
    }

    const sales = await VenueBeverageSale.find({ paymentReference: transactionId })
      .select("referenceNumber beverageName quantity unitPrice totalAmount status redeemedAt soldAt")
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      data: { transactionId, status: payment.status, total: payment.price, currency: payment.currency, sales },
    });
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error reading venue refill order:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// History — both channels at once
// ---------------------------------------------------------------------------

/**
 * Every refill payment this account has ever started, newest first — what the
 * mobile app's "Your orders" list is built from. There is no per-channel
 * equivalent of this: a customer does not think of their drink purchases as
 * split by channel, so this is the one list that reads both `BeverageSale`'s
 * and `VenueBeverageSale`'s owning payments together.
 *
 * Deliberately thin: just enough to render a row and route back into
 * `getEventRefillOrder`/`getVenueRefillOrder` (dispatched client-side on the
 * transaction id's own `BEV-`/`VBEV-` prefix) for the sale-level detail.
 */
const listMyRefillOrders = async (req, res) => {
  try {
    const payments = await Payment.find({
      userId: req.user.userId,
      salesContext: { $in: ["EVENT_BEVERAGE", "VENUE_BEVERAGE"] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .select("transactionId salesContext status price currency createdAt ticketDetails")
      .lean();

    const eventIds = [
      ...new Set(
        payments
          .filter((p) => p.salesContext === "EVENT_BEVERAGE")
          .map((p) => String(p.ticketDetails?.eventId || ""))
          .filter(Boolean)
      ),
    ];
    const venueIds = [
      ...new Set(
        payments
          .filter((p) => p.salesContext === "VENUE_BEVERAGE")
          .map((p) => String(p.ticketDetails?.venueId || ""))
          .filter(Boolean)
      ),
    ];

    const [events, venues] = await Promise.all([
      Event.find({ _id: { $in: eventIds } }).select("title").lean(),
      Venue.find({ _id: { $in: venueIds } }).select("name").lean(),
    ]);
    const eventTitleById = new Map(events.map((e) => [String(e._id), e.title]));
    const venueNameById = new Map(venues.map((v) => [String(v._id), v.name]));

    const data = payments.map((payment) => {
      const isVenue = payment.salesContext === "VENUE_BEVERAGE";
      const title = isVenue
        ? venueNameById.get(String(payment.ticketDetails?.venueId || "")) || "Drinks"
        : eventTitleById.get(String(payment.ticketDetails?.eventId || "")) || "Drinks";

      return {
        transactionId: payment.transactionId,
        channel: isVenue ? "VENUE" : "EVENT",
        status: payment.status,
        total: payment.price,
        currency: payment.currency,
        title,
        createdAt: payment.createdAt,
      };
    });

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error listing my refill orders:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "We could not load your orders. Please try again.",
    });
  }
};

/**
 * The barcode a customer shows at the counter — rendered from the pickup
 * code alone, so this needs no auth, the same way the ticket QR endpoints
 * don't: the reference number is the capability (33^6 ≈ 1.3 billion possible
 * codes, see utils/referenceCode.js), not the session.
 *
 * One route serves both channels: the code alone doesn't say whether it came
 * from an event or a venue, so this checks `BeverageSale` and falls back to
 * `VenueBeverageSale` rather than requiring the caller to know.
 */
const getRefillSaleBarcode = async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    const sale =
      (await BeverageSale.findOne({ referenceNumber }).select("referenceNumber").lean()) ||
      (await VenueBeverageSale.findOne({ referenceNumber }).select("referenceNumber").lean());
    if (!sale) throw new NotFoundError("Order not found");

    // A sale's reference number never changes once assigned, so this image
    // never changes either — cacheable like the ticket QR it sits beside.
    res.set("Cache-Control", "private, max-age=86400, immutable");
    const png = await renderBarcodePng(sale.referenceNumber);
    res.type("image/png");
    res.set("Content-Disposition", `inline; filename="${sale.referenceNumber}.png"`);
    res.send(png);
  } catch (error) {
    const status = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    if (status >= 500) console.error("Error rendering refill sale barcode:", error);
    res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * Every drink this account currently holds that is free to send to a friend
 * — the mobile "send a drink" picker's data source. `OUTSTANDING` already
 * requires `pendingShare: null` (see BeverageSale.js/VenueBeverageSale.js),
 * so a sale already mid-transfer to someone else never shows up here twice.
 */
const listTransferableRefillSales = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [eventSales, venueSales] = await Promise.all([
      BeverageSale.find({ customer: userId, ...BeverageSale.OUTSTANDING })
        .select("beverageName quantity unitPrice totalAmount currency event")
        .populate("event", "title")
        .lean(),
      VenueBeverageSale.find({ customer: userId, ...VenueBeverageSale.OUTSTANDING })
        .select("beverageName quantity unitPrice totalAmount currency venue")
        .populate("venue", "name")
        .lean(),
    ]);

    const data = [
      ...eventSales.map((sale) => ({
        saleId: sale._id,
        salesContext: "EVENT_BEVERAGE",
        beverageName: sale.beverageName,
        title: sale.event?.title || "Drinks",
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        currency: sale.currency,
      })),
      ...venueSales.map((sale) => ({
        saleId: sale._id,
        salesContext: "VENUE_BEVERAGE",
        beverageName: sale.beverageName,
        title: sale.venue?.name || "Drinks",
        quantity: sale.quantity,
        unitPrice: sale.unitPrice,
        totalAmount: sale.totalAmount,
        currency: sale.currency,
      })),
    ];

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (error) {
    console.error("Error listing transferable refill sales:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "We could not load your drinks. Please try again.",
    });
  }
};

module.exports = {
  quoteEventRefillCheckout,
  startEventRefillCheckout,
  settleEventRefillPayment,
  getEventRefillOrder,
  quoteVenueRefillCheckout,
  startVenueRefillCheckout,
  settleVenueRefillPayment,
  getVenueRefillOrder,
  listMyRefillOrders,
  getRefillSaleBarcode,
  listTransferableRefillSales,
};
