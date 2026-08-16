const mongoose = require("mongoose");
const EventBeverage = require("../models/EventBeverage");
const BeverageSale = require("../models/BeverageSale");
const { BadRequestError } = require("../errors");

// Pricing and fulfilment for drinks bought during ticket checkout.
//
// The rule that governs this whole file is the same one utils/pricing.js states
// for tickets: the client tells us WHAT it wants, never WHAT IT COSTS. Every
// amount here is recomputed from EventBeverage on the server, and the caller
// must charge the figure this returns — never one supplied by the browser.

const MAX_BASKET_LINES = 20;
const MAX_QUANTITY_PER_LINE = 50;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Price a basket against the event's own line-up.
 *
 * Returns `{ ok: false, statusCode, message }` on any problem rather than
 * throwing, so the checkout route can surface it the way it already does for
 * ticket pricing failures.
 *
 * Availability is checked here for a fast, friendly error, but this is NOT the
 * guarantee — stock is only truly claimed by the atomic decrement in
 * `fulfilBasket`. Between the two, someone else may take the last bottle.
 */
const priceBasket = async ({ eventId, items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, lines: [], total: 0, currency: "ETB" };
  }
  if (items.length > MAX_BASKET_LINES) {
    return {
      ok: false,
      statusCode: 400,
      message: `A basket can hold at most ${MAX_BASKET_LINES} different items`,
    };
  }

  // Collapse duplicate lines so someone cannot slip past the per-line quantity
  // cap by sending the same item twenty times.
  const wanted = new Map();
  for (const item of items) {
    const id = String(item?.eventBeverageId || item?.id || "").trim();
    const qty = Number(item?.quantity);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { ok: false, statusCode: 400, message: "Invalid item in the basket" };
    }
    if (!Number.isInteger(qty) || qty < 1) {
      return { ok: false, statusCode: 400, message: "Item quantity must be a whole number of at least 1" };
    }
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  for (const [, qty] of wanted) {
    if (qty > MAX_QUANTITY_PER_LINE) {
      return {
        ok: false,
        statusCode: 400,
        message: `You can buy at most ${MAX_QUANTITY_PER_LINE} of any one item`,
      };
    }
  }

  const ids = [...wanted.keys()].map((id) => new mongoose.Types.ObjectId(id));
  const rows = await EventBeverage.find({ _id: { $in: ids } })
    .populate("beverage", "name color")
    .lean();

  if (rows.length !== wanted.size) {
    return { ok: false, statusCode: 404, message: "One of the drinks is no longer on this event" };
  }

  const lines = [];
  let total = 0;
  let currency = "ETB";

  for (const row of rows) {
    const qty = wanted.get(String(row._id));

    // Every line must belong to the event being checked out. Without this a
    // basket could reference a cheaper event's line-up and pay its prices.
    if (String(row.event) !== String(eventId)) {
      return { ok: false, statusCode: 400, message: "That drink is not sold at this event" };
    }
    if (!row.isAvailable) {
      return { ok: false, statusCode: 400, message: `${row.beverage?.name || "That drink"} is not available` };
    }

    const remaining = Math.max((row.stockTotal || 0) - (row.sold || 0), 0);
    if (remaining < qty) {
      return {
        ok: false,
        statusCode: 400,
        message: remaining === 0
          ? `${row.beverage?.name || "That drink"} is sold out`
          : `Only ${remaining} left of ${row.beverage?.name || "that drink"}`,
      };
    }

    currency = row.currency || "ETB";
    const lineTotal = round2(row.price * qty);
    total += lineTotal;

    lines.push({
      eventBeverageId: row._id,
      beverageId: row.beverage?._id,
      name: row.beverage?.name,
      color: row.beverage?.color || null,
      unitPrice: row.price,
      quantity: qty,
      lineTotal,
      currency,
    });
  }

  return { ok: true, lines, total: round2(total), currency };
};

/**
 * Turn a priced basket into sales, after the money has been taken.
 *
 * Prices are re-read from the database rather than trusted from the stored
 * basket: a payment can settle minutes after checkout began, and the sale must
 * record what the item is actually worth, not a stale figure carried through
 * the payment provider's metadata.
 *
 * Stock is claimed with the same conditional-update pattern the ticket flow
 * uses — the availability check in `priceBasket` reads a snapshot that can go
 * stale, so the decrement itself must re-verify or two buyers can take the same
 * last bottle.
 *
 * The buyer has already paid by this point, so a sold-out line must not throw
 * the whole fulfilment away: it is reported in `failed` for a refund decision,
 * and everything that could be honoured is.
 */
const fulfilBasket = async ({ eventId, organizerId, lines, customer, customerName, customerPhone, paymentReference }) => {
  const created = [];
  const failed = [];

  for (const line of lines || []) {
    const qty = Number(line.quantity) || 0;
    if (qty < 1) continue;

    const reserved = await EventBeverage.findOneAndUpdate(
      {
        _id: line.eventBeverageId,
        event: eventId,
        isAvailable: true,
        $expr: { $gte: [{ $subtract: ["$stockTotal", "$sold"] }, qty] },
      },
      { $inc: { sold: qty } },
      { new: true }
    ).populate("beverage", "name color");

    if (!reserved) {
      failed.push({
        eventBeverageId: line.eventBeverageId,
        name: line.name,
        quantity: qty,
        reason: "sold out before the payment settled",
      });
      continue;
    }

    try {
      const sale = await BeverageSale.create({
        event: reserved.event,
        organizer: organizerId || reserved.organizer,
        eventBeverage: reserved._id,
        beverage: reserved.beverage._id,
        beverageName: reserved.beverage.name,
        beverageColor: reserved.beverage.color || null,
        unitPrice: reserved.price,
        quantity: qty,
        totalAmount: round2(reserved.price * qty),
        currency: reserved.currency,
        customer: customer || undefined,
        customerName,
        customerPhone,
        channel: "online",
        paymentReference,
        // commissionRate is snapshotted by the BeverageSale pre-validate hook.
      });
      created.push(sale);
    } catch (error) {
      // Stock was already claimed; hand it back rather than lose it to a row
      // that does not exist.
      await EventBeverage.updateOne({ _id: reserved._id }, { $inc: { sold: -qty } });
      failed.push({
        eventBeverageId: line.eventBeverageId,
        name: line.name,
        quantity: qty,
        reason: error.message,
      });
    }
  }

  return { created, failed };
};

module.exports = {
  MAX_BASKET_LINES,
  MAX_QUANTITY_PER_LINE,
  priceBasket,
  fulfilBasket,
};
