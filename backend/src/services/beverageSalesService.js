const mongoose = require("mongoose");
const EventBeverage = require("../models/EventBeverage");
const BeverageSale = require("../models/BeverageSale");
const Event = require("../models/Event");
const { BadRequestError, NotFoundError } = require("../errors");
const { mirrorSale } = require("./ledgerDualWrite");
const HappyHour = require("../models/HappyHour");
const { resolveEffectivePrice } = require("../utils/happyHour");
const { resolveEatInstant, endOfEatDay } = require("../utils/eatTime");

// A pre-bought drink can't be collected more than this long after the event
// itself is over — an event has no showtime-style `endsAt` the way a cinema
// screening does, so this combines whichever end date/time the organizer
// actually entered (falling back to the start date/time, then to end-of-day,
// if no end was given) via the same EAT-anchoring `resolveEatInstant` already
// uses for ticket wave windows.
const REDEEM_GRACE_HOURS_AFTER_EVENT = 12;

const computeEventEndsAt = (event) => {
  if (!event) return null;
  return (
    resolveEatInstant(event.endDate || event.startDate, event.endTime) ||
    (event.startDate ? endOfEatDay(event.startDate) : null)
  );
};

// Sales are recorded here rather than in the controller so the eventual
// customer checkout can call recordSale() directly from the payment webhook,
// server-side, without going back out through HTTP.

// Reserves stock and writes the ledger row.
//
// The reservation is a single atomic findOneAndUpdate guarded by $expr: the
// "is there room?" comparison and the increment happen in one operation, so two
// purchases landing at the same moment cannot both claim the last bottle. A
// read-then-write here would oversell under exactly the load this feature is
// for — everyone buying in the hour before an event.
const recordSale = async ({
  eventBeverageId,
  quantity,
  customer,
  customerName,
  customerPhone,
  channel = "manual",
}) => {
  if (!mongoose.Types.ObjectId.isValid(eventBeverageId)) {
    throw new NotFoundError("That drink is not on this event");
  }

  const requested = Number(quantity);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new BadRequestError("quantity must be a whole number of at least 1");
  }

  const line = await EventBeverage.findById(eventBeverageId).populate(
    "beverage",
    "name color isActive"
  );
  if (!line) throw new NotFoundError("That drink is not on this event");
  if (!line.isAvailable) {
    throw new BadRequestError("That drink is not currently on sale");
  }
  if (!line.beverage) {
    throw new BadRequestError("That drink is no longer in the catalogue");
  }
  if (!line.beverage.isActive) {
    throw new BadRequestError("That drink is not currently available");
  }

  const reserved = await EventBeverage.findOneAndUpdate(
    {
      _id: line._id,
      isAvailable: true,
      // Only matches while the sale still fits inside the listed stock.
      $expr: { $lte: [{ $add: ["$sold", requested] }, "$stockTotal"] },
    },
    { $inc: { sold: requested } },
    { new: true }
  );

  if (!reserved) {
    const remaining = Math.max(line.stockTotal - line.sold, 0);
    throw new BadRequestError(
      remaining === 0
        ? `${line.beverage.name} is sold out`
        : `Only ${remaining} left of ${line.beverage.name}`
    );
  }

  try {
    // A counter/manual sale honors a running happy hour exactly like an
    // online one — the discount is a property of the drink, not of the
    // channel someone bought it through.
    const happyHours = await HappyHour.find({ event: reserved.event, cancelledAt: null }).lean();
    const unitPrice = resolveEffectivePrice(happyHours, reserved._id, reserved.price);
    const sale = await BeverageSale.create({
      event: reserved.event,
      organizer: reserved.organizer,
      eventBeverage: reserved._id,
      beverage: line.beverage._id,
      beverageName: line.beverage.name,
      beverageColor: line.beverage.color || null,
      unitPrice,
      quantity: requested,
      totalAmount: Math.round(unitPrice * requested * 100) / 100,
      currency: reserved.currency,
      customer: customer || undefined,
      customerName,
      customerPhone,
      channel,
    });

    // Shadow-write to the ledger; never allowed to fail the sale. See
    // services/ledgerDualWrite.
    await mirrorSale({
      owner: { kind: "organizer", id: sale.organizer },
      stream: "beverages",
      grossAmount: sale.totalAmount,
      commissionRate: sale.commissionRate,
      vatRate: sale.vatRate,
      ownerVatRate: sale.organizerVatRate,
      source: { beverageSale: sale._id },
      reference: `beverage_sale:${sale._id}`,
      occurredAt: sale.soldAt,
    });

    return sale;
  } catch (error) {
    // The stock was already claimed above. If the ledger write fails the
    // bottles must go back, or they are lost to a row that does not exist.
    await EventBeverage.updateOne({ _id: reserved._id }, { $inc: { sold: -requested } });
    throw error;
  }
};

// Refunds return the stock and take the sale out of revenue, but keep the row:
// a refund is history, not an erasure.
const refundSale = async (saleId, { adminId, reason } = {}) => {
  const sale = await BeverageSale.findById(saleId);
  if (!sale) throw new NotFoundError("Sale not found");
  if (sale.status === "refunded") {
    throw new BadRequestError("That sale is already refunded");
  }

  sale.status = "refunded";
  sale.refundedAt = new Date();
  if (adminId) sale.refundedBy = adminId;
  if (reason) sale.refundReason = reason;
  await sale.save();

  // Never let the counter go below zero, whatever the row's history.
  await EventBeverage.updateOne(
    { _id: sale.eventBeverage, sold: { $gte: sale.quantity } },
    { $inc: { sold: -sale.quantity } }
  );

  return sale;
};

/**
 * What a ticket-holder has paid for online and not yet collected, across
 * every "refill" order they've made at this event.
 *
 * Keyed by event + customer rather than by one order/paymentReference: a
 * refill purchase can happen more than once over the course of an event, and
 * the customer should be able to show the same ticket QR at the counter each
 * time rather than a fresh code per purchase.
 */
const listOutstandingForCustomer = async ({ eventId, customerId }) => {
  if (!eventId || !customerId) return [];
  return BeverageSale.find({
    event: eventId,
    customer: customerId,
    ...BeverageSale.OUTSTANDING,
  })
    .select("referenceNumber beverageName quantity unitPrice totalAmount soldAt")
    .lean();
};

/**
 * What's still owed on ONE order — the shape a door scanner actually needs,
 * since it only ever has the code it just scanned, not the buyer's account.
 * `referenceNumber` is the human-facing pickup code (e.g. "EV-7K2QXM")
 * rendered as a barcode for the customer — see BeverageSale.js's own field
 * comment and utils/barcodeRenderer.js. Mirrors cinemaBeverageController's
 * listOutstandingForOrder and venueSalesController's getOutstandingVenueOrder,
 * the event-side beverage ledger's twin of both.
 *
 * Returns every sale under that reference regardless of status, not just the
 * outstanding ones — the caller (getOutstandingByReference) needs the full
 * set to know which EVENT this reference belongs to (for authorization) even
 * when every item on it has already been collected.
 */
const listSalesByReference = async ({ referenceNumber }) => {
  if (!referenceNumber) return [];
  return BeverageSale.find({ referenceNumber })
    .select(
      "event referenceNumber beverageName quantity unitPrice totalAmount soldAt status channel redeemedAt pendingShare"
    )
    .lean();
};

/**
 * Hand a pre-bought drink over.
 *
 * The guard is a single findOneAndUpdate matching OUTSTANDING: the "has this
 * already been collected?" check and the write happen in one operation, so
 * two staff at the same door cannot both hand over the same drink. Scoped to
 * `eventId` so a redeem call can't reach another event's sale even if a route
 * is later mis-wired.
 *
 * Refusal is deliberately specific — "already collected at 19:42" is what
 * lets staff resolve a dispute at the door, where a generic failure would not.
 */
const redeemSale = async ({ saleId, eventId, redeemedBy }) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw new NotFoundError("That drink is not on this order");
  }

  if (eventId) {
    const event = await Event.findById(eventId).select(
      "startDate endDate startTime endTime"
    );
    const eventEndsAt = computeEventEndsAt(event);
    if (eventEndsAt) {
      const cutoff = new Date(
        eventEndsAt.getTime() + REDEEM_GRACE_HOURS_AFTER_EVENT * 60 * 60 * 1000
      );
      if (new Date() > cutoff) {
        throw new BadRequestError(
          "This event ended more than 12 hours ago — the drink can no longer be redeemed."
        );
      }
    }
  }

  const redeemed = await BeverageSale.findOneAndUpdate(
    {
      _id: saleId,
      ...(eventId ? { event: eventId } : {}),
      ...BeverageSale.OUTSTANDING,
    },
    { $set: { redeemedAt: new Date(), redeemedBy: redeemedBy || undefined } },
    { new: true }
  );

  if (redeemed) return redeemed;

  const sale = await BeverageSale.findOne({
    _id: saleId,
    ...(eventId ? { event: eventId } : {}),
  }).lean();

  if (!sale) throw new NotFoundError("That drink is not on this order");
  if (sale.status === "refunded") {
    throw new BadRequestError("That drink was refunded and is not owed");
  }
  if (sale.channel !== "online") {
    throw new BadRequestError(
      "That was sold at the counter and was handed over at the time"
    );
  }
  if (sale.pendingShare) {
    throw new BadRequestError(
      "This drink is being transferred to someone else and can't be collected until that finishes"
    );
  }
  throw new BadRequestError(
    `Already collected at ${sale.redeemedAt ? new Date(sale.redeemedAt).toLocaleString() : "an earlier time"}`
  );
};

module.exports = {
  recordSale,
  refundSale,
  listOutstandingForCustomer,
  listSalesByReference,
  redeemSale,
  computeEventEndsAt,
  REDEEM_GRACE_HOURS_AFTER_EVENT,
};
