const mongoose = require("mongoose");
const CinemaBeverage = require("../models/CinemaBeverage");
const CinemaBeverageSale = require("../models/CinemaBeverageSale");
const CinemaShowtime = require("../models/CinemaShowtime");
const { BadRequestError, NotFoundError } = require("../errors");
const { mirrorSale } = require("./ledgerDualWrite");

// The cinema channel's twin of beverageSalesService and
// venueBeverageSalesService.
//
// Sales are recorded here rather than in the controller so a customer checkout
// can call recordSale() directly from the payment webhook, server-side, without
// going back out through HTTP — the same reason the other two services exist.
//
// Every write in this file targets CinemaBeverage / CinemaBeverageSale and takes
// a cinema id. There is no code path through which an event id, an organizer id
// or a venue id can reach a cinema sale, or the reverse.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Reserves stock and writes the ledger row.
//
// The reservation is a single atomic findOneAndUpdate guarded by $expr: the
// "is there room?" comparison and the increment happen in one operation, so two
// purchases landing at the same moment cannot both claim the last bucket of
// popcorn. A read-then-write here would oversell under exactly the load a
// concession counter produces in the five minutes before a screening.
const recordSale = async ({
  cinemaBeverageId,
  quantity,
  customer,
  customerName,
  customerPhone,
  channel = "manual",
  paymentReference,
  // Optional. Attributes the sale to a screening for per-showing reporting.
  // Never affects the money split — that is the cinema's rate regardless.
  showtimeId,
  // Optional. When set, the line must belong to this cinema or the sale is
  // refused — the guard that stops a caller recording revenue against a cinema
  // it does not own by passing someone else's line id.
  cinemaId,
}) => {
  if (!mongoose.Types.ObjectId.isValid(cinemaBeverageId)) {
    throw new NotFoundError("That item is not sold at this cinema");
  }

  const requested = Number(quantity);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new BadRequestError("quantity must be a whole number of at least 1");
  }

  const line = await CinemaBeverage.findById(cinemaBeverageId).populate(
    "beverage",
    "name color category isActive"
  );
  if (!line) throw new NotFoundError("That item is not sold at this cinema");
  if (cinemaId && String(line.cinema) !== String(cinemaId)) {
    // Answered as "not found" rather than "forbidden" for the same reason the
    // other channels do it: probing ids should not confirm what exists.
    throw new NotFoundError("That item is not sold at this cinema");
  }
  if (!line.isAvailable) {
    throw new BadRequestError("That item is not currently on sale");
  }
  if (!line.beverage) {
    throw new BadRequestError("That item is no longer in the catalogue");
  }
  if (!line.beverage.isActive) {
    throw new BadRequestError("That item is not currently available");
  }

  // A showtime passed in must belong to the same cinema, or concession revenue
  // would be attributed to another cinema's screening.
  let showtime;
  if (showtimeId) {
    if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
      throw new NotFoundError("Showtime not found");
    }
    showtime = await CinemaShowtime.findById(showtimeId).select("cinema").lean();
    if (!showtime || String(showtime.cinema) !== String(line.cinema)) {
      throw new NotFoundError("Showtime not found");
    }
  }

  // An unlimited line skips the ceiling entirely rather than comparing against
  // a very large number: "we do not count this" and "we have 9,999 of these"
  // are different statements, and only the first stays true tomorrow. `sold`
  // still increments either way, so revenue and popularity reporting do not
  // care which kind of line this is.
  const reserved = await CinemaBeverage.findOneAndUpdate(
    {
      _id: line._id,
      isAvailable: true,
      ...(line.unlimitedStock
        ? {}
        : {
            // Only matches while the sale still fits inside the listed stock.
            $expr: { $lte: [{ $add: ["$sold", requested] }, "$stockTotal"] },
          }),
    },
    { $inc: { sold: requested } },
    { new: true }
  );

  if (!reserved) {
    // Unreachable on an unlimited line unless it was switched off mid-request,
    // which is what the availability half of the filter is for.
    if (line.unlimitedStock) {
      throw new BadRequestError(`${line.beverage.name} is not currently on sale`);
    }
    const remaining = Math.max(line.stockTotal - line.sold, 0);
    throw new BadRequestError(
      remaining === 0
        ? `${line.beverage.name} is sold out`
        : `Only ${remaining} left of ${line.beverage.name}`
    );
  }

  try {
    const sale = await CinemaBeverageSale.create({
      cinema: reserved.cinema,
      cinemaBeverage: reserved._id,
      beverage: line.beverage._id,
      showtime: showtime ? showtimeId : undefined,
      beverageName: line.beverage.name,
      beverageColor: line.beverage.color || null,
      beverageCategory: line.beverage.category || "drink",
      unitPrice: reserved.price,
      quantity: requested,
      totalAmount: round2(reserved.price * requested),
      currency: reserved.currency,
      customer: customer || undefined,
      customerName,
      customerPhone,
      channel,
      paymentReference,
      // commissionRate and cinemaVatRate are snapshotted by the model hook.
    });

    // Shadow-write to the ledger; never allowed to fail the sale. See
    // services/ledgerDualWrite.
    await mirrorSale({
      owner: { kind: "cinema", id: sale.cinema },
      stream: "beverages",
      grossAmount: sale.totalAmount,
      commissionRate: sale.commissionRate,
      ownerVatRate: sale.cinemaVatRate,
      source: { cinemaBeverageSale: sale._id },
      reference: `cinema_beverage_sale:${sale._id}`,
      occurredAt: sale.soldAt,
    });

    return sale;
  } catch (error) {
    // The stock was already claimed above. If the ledger write fails the items
    // must go back, or they are lost to a row that does not exist.
    await CinemaBeverage.updateOne(
      { _id: reserved._id },
      { $inc: { sold: -requested } }
    );
    throw error;
  }
};

// Refunds return the stock and take the sale out of revenue, but keep the row:
// a refund is history, not an erasure.
const refundSale = async (saleId, { adminId, reason } = {}) => {
  const sale = await CinemaBeverageSale.findById(saleId);
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
  await CinemaBeverage.updateOne(
    { _id: sale.cinemaBeverage, sold: { $gte: sale.quantity } },
    { $inc: { sold: -sale.quantity } }
  );

  return sale;
};

/**
 * What a customer has paid for online and not yet collected, for one order.
 *
 * Keyed by the payment reference rather than by ticket, because one order can
 * carry several tickets and a single popcorn — collection belongs to the order,
 * not to whichever ticket staff happened to scan.
 */
const listOutstandingForOrder = async ({ paymentReference, cinemaId }) => {
  if (!paymentReference) return [];
  return CinemaBeverageSale.find({
    paymentReference,
    ...(cinemaId ? { cinema: cinemaId } : {}),
    ...CinemaBeverageSale.OUTSTANDING,
  })
    .select("referenceNumber beverageName beverageCategory quantity unitPrice totalAmount soldAt")
    .lean();
};

/**
 * Hand a pre-bought item over.
 *
 * The guard is a single findOneAndUpdate matching OUTSTANDING: the "has this
 * already been collected?" check and the write happen in one operation, so two
 * staff scanning the same order at two tills cannot both hand over the same
 * popcorn. A read-then-write here would do exactly that, and this is the one
 * moment where the whole point is that it happens once.
 *
 * Refusal is deliberately specific — "already collected at 19:42" is what lets
 * staff resolve a dispute at the counter, where a generic failure would not.
 */
const redeemSale = async ({ saleId, cinemaId, redeemedBy }) => {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    throw new NotFoundError("That item is not on this order");
  }

  const redeemed = await CinemaBeverageSale.findOneAndUpdate(
    {
      _id: saleId,
      // Scoped in the query, so a cinema cannot collect against another's sale
      // even if a route is later mis-wired.
      ...(cinemaId ? { cinema: cinemaId } : {}),
      ...CinemaBeverageSale.OUTSTANDING,
    },
    { $set: { redeemedAt: new Date(), redeemedBy: redeemedBy || undefined } },
    { new: true }
  );

  if (redeemed) return redeemed;

  // Nothing matched. Say why, from the row's actual state.
  const sale = await CinemaBeverageSale.findOne({
    _id: saleId,
    ...(cinemaId ? { cinema: cinemaId } : {}),
  }).lean();

  if (!sale) throw new NotFoundError("That item is not on this order");
  if (sale.status === "refunded") {
    throw new BadRequestError("That item was refunded and is not owed");
  }
  if (sale.channel !== "online") {
    throw new BadRequestError(
      "That was sold at the counter and was handed over at the time"
    );
  }
  throw new BadRequestError(
    `Already collected at ${sale.redeemedAt ? new Date(sale.redeemedAt).toLocaleString() : "an earlier time"}`
  );
};

module.exports = {
  recordSale,
  refundSale,
  listOutstandingForOrder,
  redeemSale,
};
