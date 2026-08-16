const mongoose = require("mongoose");
const VenueBeverage = require("../models/VenueBeverage");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const { BadRequestError, NotFoundError } = require("../errors");

// The venue channel's twin of beverageSalesService.
//
// Sales are recorded here rather than in the controller so a customer checkout
// can call recordSale() directly from the payment webhook, server-side, without
// going back out through HTTP — the same reason the event-side service exists.
//
// Every write in this file targets VenueBeverage / VenueBeverageSale and takes a
// venue id. There is no code path through which an event id or an organizer id
// can reach a venue sale, or the reverse.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Reserves stock and writes the ledger row.
//
// The reservation is a single atomic findOneAndUpdate guarded by $expr: the
// "is there room?" comparison and the increment happen in one operation, so two
// purchases landing at the same moment cannot both claim the last bottle. A
// read-then-write here would oversell under exactly the load a busy bar
// produces on a Friday night.
const recordSale = async ({
  venueBeverageId,
  quantity,
  customer,
  customerName,
  customerPhone,
  channel = "manual",
  paymentReference,
  // Optional. When set, the line must belong to this venue or the sale is
  // refused — the guard that stops a caller recording revenue against a venue
  // it does not own by passing someone else's line id.
  venueId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(venueBeverageId)) {
    throw new NotFoundError("That drink is not sold at this venue");
  }

  const requested = Number(quantity);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new BadRequestError("quantity must be a whole number of at least 1");
  }

  const line = await VenueBeverage.findById(venueBeverageId).populate(
    "beverage",
    "name color isActive"
  );
  if (!line) throw new NotFoundError("That drink is not sold at this venue");
  if (venueId && String(line.venue) !== String(venueId)) {
    // Answered as "not found" rather than "forbidden" for the same reason
    // resolveEventContext does: probing ids should not confirm what exists.
    throw new NotFoundError("That drink is not sold at this venue");
  }
  if (!line.isAvailable) {
    throw new BadRequestError("That drink is not currently on sale");
  }
  if (!line.beverage) {
    throw new BadRequestError("That drink is no longer in the catalogue");
  }
  if (!line.beverage.isActive) {
    throw new BadRequestError("That drink is not currently available");
  }

  const reserved = await VenueBeverage.findOneAndUpdate(
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
    return await VenueBeverageSale.create({
      venue: reserved.venue,
      venueBeverage: reserved._id,
      beverage: line.beverage._id,
      beverageName: line.beverage.name,
      beverageColor: line.beverage.color || null,
      unitPrice: reserved.price,
      quantity: requested,
      totalAmount: round2(reserved.price * requested),
      currency: reserved.currency,
      customer: customer || undefined,
      customerName,
      customerPhone,
      channel,
      paymentReference,
      // commissionRate and venueVatRate are snapshotted by the model hook.
    });
  } catch (error) {
    // The stock was already claimed above. If the ledger write fails the
    // bottles must go back, or they are lost to a row that does not exist.
    await VenueBeverage.updateOne(
      { _id: reserved._id },
      { $inc: { sold: -requested } }
    );
    throw error;
  }
};

// Refunds return the stock and take the sale out of revenue, but keep the row:
// a refund is history, not an erasure.
const refundSale = async (saleId, { adminId, reason } = {}) => {
  const sale = await VenueBeverageSale.findById(saleId);
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
  await VenueBeverage.updateOne(
    { _id: sale.venueBeverage, sold: { $gte: sale.quantity } },
    { $inc: { sold: -sale.quantity } }
  );

  return sale;
};

module.exports = { recordSale, refundSale };
