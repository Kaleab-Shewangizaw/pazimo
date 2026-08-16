const mongoose = require("mongoose");
const {
  validBeverageSaleMatch,
  COMMISSION_EXPR,
  VAT_EXPR,
  buildBeverageRevenueExpressions,
} = require("./beverageRevenueQuery");

// The venue channel's revenue reader.
//
// Every expression here comes from beverageRevenueQuery — commission, the 15%
// VAT charged on that commission, and the seller's share are computed by the
// same code the event channel uses. What differs is only which ledger is read
// and which field holds the withheld VAT rate (`venueVatRate`, from
// Venue.coversVenueVat).
//
// That is the deliberate shape: two ledgers so venue money can never be summed
// into an organizer's balance by an aggregation that forgot to filter, but one
// definition of what a 3% cut means, so the two channels cannot drift apart.

const {
  ownerVatRateExpr: VENUE_VAT_RATE_EXPR,
  ownerVatExpr: VENUE_VAT_EXPR,
  ownerShareExpr: VENUE_SHARE_EXPR,
} = buildBeverageRevenueExpressions("venueVatRate");

/**
 * Accumulators for any $group over venue beverage sales.
 *
 * Keys mirror beverageRevenueAccumulators(), with the seller-facing two named
 * for the venue — `venueVat` and `venueRevenue` rather than `organizerVat` and
 * `organizerRevenue`. A venue's money must never be readable through a field
 * called "organizer": that is precisely the confusion this channel split
 * exists to prevent, and a mislabelled key is how it would creep back in.
 */
const venueBeverageRevenueAccumulators = () => ({
  grossRevenue: { $sum: "$totalAmount" },
  pazimoCommission: { $sum: COMMISSION_EXPR },
  vatOnCommission: { $sum: VAT_EXPR },
  venueVat: { $sum: VENUE_VAT_EXPR },
  venueRevenue: { $sum: VENUE_SHARE_EXPR },
  unitsSold: { $sum: "$quantity" },
});

const EMPTY_TOTALS = {
  grossRevenue: 0,
  pazimoCommission: 0,
  vatOnCommission: 0,
  venueVat: 0,
  venueRevenue: 0,
  unitsSold: 0,
  salesCount: 0,
};

/**
 * One venue's beverage totals.
 *
 * Scoped by `venue`, using { venue, status, soldAt }. The id is cast here for
 * the same reason getOrganizerBeverageRevenue casts: aggregation $match does no
 * schema casting, so a string id silently matches nothing — and a balance that
 * silently reads 0.00 is the worst possible failure mode for a payout.
 */
const getVenueBeverageRevenue = async (venueId, currency = "ETB") => {
  // Required lazily so this file stays importable from models without closing a
  // cycle through the model registry.
  const VenueBeverageSale = require("../models/VenueBeverageSale");

  if (!venueId || !mongoose.Types.ObjectId.isValid(String(venueId))) {
    return { ...EMPTY_TOTALS };
  }

  const venue =
    venueId instanceof mongoose.Types.ObjectId
      ? venueId
      : new mongoose.Types.ObjectId(String(venueId));

  const [row] = await VenueBeverageSale.aggregate([
    { $match: { venue, ...validBeverageSaleMatch(currency) } },
    {
      $group: {
        _id: null,
        salesCount: { $sum: 1 },
        ...venueBeverageRevenueAccumulators(),
      },
    },
  ]);

  return {
    grossRevenue: row?.grossRevenue || 0,
    pazimoCommission: row?.pazimoCommission || 0,
    vatOnCommission: row?.vatOnCommission || 0,
    venueVat: row?.venueVat || 0,
    venueRevenue: row?.venueRevenue || 0,
    unitsSold: row?.unitsSold || 0,
    salesCount: row?.salesCount || 0,
  };
};

module.exports = {
  VENUE_VAT_RATE_EXPR,
  VENUE_VAT_EXPR,
  VENUE_SHARE_EXPR,
  venueBeverageRevenueAccumulators,
  getVenueBeverageRevenue,
  EMPTY_VENUE_TOTALS: EMPTY_TOTALS,
};
