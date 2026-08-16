const mongoose = require("mongoose");
const { DEFAULT_COMMISSION_RATE, VAT_RATE } = require("../config/rates");

// The beverage twin of ticketRevenueQuery.js.
//
// Beverage revenue is reported as its own stream — organizers and admins want
// "X from tickets, Y from drinks" as two figures — but it runs through the same
// commission and VAT mechanism. Separate reporting, shared machinery: that is
// what stops this becoming a second parallel money system, which is exactly how
// beverage revenue ended up invisible to balances in the first place.

/**
 * Sales that count as revenue.
 *
 * Refunds stay in the ledger deliberately (a refund is history, not an erasure)
 * so they must be excluded here rather than deleted at source.
 */
const validBeverageSaleMatch = (currency = "ETB") => ({
  status: "confirmed",
  totalAmount: { $gt: 0 },
  currency,
});

// Sales made before per-event beverage commission existed carry no snapshot and
// fall back to the default that was in force.
const COMMISSION_RATE_EXPR = {
  $ifNull: ["$commissionRate", DEFAULT_COMMISSION_RATE],
};

const COMMISSION_EXPR = { $multiply: ["$totalAmount", COMMISSION_RATE_EXPR] };

// VAT is 15% OF the commission, not of the sale price — a 3% cut costs the
// organizer 3.45%.
const VAT_EXPR = { $multiply: ["$totalAmount", COMMISSION_RATE_EXPR, VAT_RATE] };

const ORGANIZER_SHARE_EXPR = {
  $subtract: [
    "$totalAmount",
    { $multiply: ["$totalAmount", COMMISSION_RATE_EXPR, 1 + VAT_RATE] },
  ],
};

/**
 * Accumulators for any $group over beverage sales. Field names deliberately
 * mirror ticketRevenueQuery.revenueAccumulators so callers can treat the two
 * streams uniformly and simply add them.
 */
const beverageRevenueAccumulators = () => ({
  grossRevenue: { $sum: "$totalAmount" },
  pazimoCommission: { $sum: COMMISSION_EXPR },
  vatOnCommission: { $sum: VAT_EXPR },
  organizerRevenue: { $sum: ORGANIZER_SHARE_EXPR },
  unitsSold: { $sum: "$quantity" },
});

/**
 * One organizer's beverage totals.
 *
 * Scoped by `organizer` directly — BeverageSale denormalises it, so unlike
 * tickets there is no event-id round trip. Uses { organizer, status, soldAt }.
 */
const getOrganizerBeverageRevenue = async (organizerId, currency = "ETB") => {
  // Required lazily so this file stays importable from models without closing a
  // cycle through the model registry.
  const BeverageSale = require("../models/BeverageSale");

  // Aggregation $match does no schema casting the way find() does, so the
  // string id every caller holds (req.user.userId, req.params.organizerId)
  // matches zero documents unless it is cast here. That silence is what made
  // the withdrawal balance read 0.00 while the beverage dashboard — which
  // casts — showed the real figure off the same collection.
  const organizer =
    organizerId instanceof mongoose.Types.ObjectId
      ? organizerId
      : new mongoose.Types.ObjectId(String(organizerId));

  const [row] = await BeverageSale.aggregate([
    { $match: { organizer, ...validBeverageSaleMatch(currency) } },
    { $group: { _id: null, salesCount: { $sum: 1 }, ...beverageRevenueAccumulators() } },
  ]);

  return {
    grossRevenue: row?.grossRevenue || 0,
    pazimoCommission: row?.pazimoCommission || 0,
    vatOnCommission: row?.vatOnCommission || 0,
    organizerRevenue: row?.organizerRevenue || 0,
    unitsSold: row?.unitsSold || 0,
    salesCount: row?.salesCount || 0,
  };
};

module.exports = {
  validBeverageSaleMatch,
  COMMISSION_RATE_EXPR,
  COMMISSION_EXPR,
  VAT_EXPR,
  ORGANIZER_SHARE_EXPR,
  beverageRevenueAccumulators,
  getOrganizerBeverageRevenue,
};
