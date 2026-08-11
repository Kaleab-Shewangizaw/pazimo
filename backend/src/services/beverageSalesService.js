const mongoose = require("mongoose");
const EventBeverage = require("../models/EventBeverage");
const BeverageSale = require("../models/BeverageSale");
const { BadRequestError, NotFoundError } = require("../errors");

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
    return await BeverageSale.create({
      event: reserved.event,
      organizer: reserved.organizer,
      eventBeverage: reserved._id,
      beverage: line.beverage._id,
      beverageName: line.beverage.name,
      beverageColor: line.beverage.color || null,
      unitPrice: reserved.price,
      quantity: requested,
      totalAmount: Math.round(reserved.price * requested * 100) / 100,
      currency: reserved.currency,
      customer: customer || undefined,
      customerName,
      customerPhone,
      channel,
    });
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

module.exports = { recordSale, refundSale };
