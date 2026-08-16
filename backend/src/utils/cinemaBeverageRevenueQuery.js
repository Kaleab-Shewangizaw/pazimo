const mongoose = require("mongoose");
const {
  validBeverageSaleMatch,
  COMMISSION_EXPR,
  VAT_EXPR,
  buildBeverageRevenueExpressions,
} = require("./beverageRevenueQuery");

// The cinema channel's CONCESSION revenue reader.
//
// Every expression here comes from beverageRevenueQuery — commission, the 15%
// VAT charged on that commission, and the seller's share are computed by the
// same code the event and venue channels use. What differs is only which ledger
// is read and which field holds the withheld VAT rate (`cinemaVatRate`, from
// Cinema.coversCinemaVat).
//
// That is the deliberate shape: three ledgers so cinema money can never be
// summed into an organizer's or a venue's balance by an aggregation that forgot
// to filter, but one definition of what a 3% cut means, so the channels cannot
// drift apart.

const {
  ownerVatRateExpr: CINEMA_VAT_RATE_EXPR,
  ownerVatExpr: CINEMA_VAT_EXPR,
  ownerShareExpr: CINEMA_SHARE_EXPR,
} = buildBeverageRevenueExpressions("cinemaVatRate");

/**
 * Accumulators for any $group over cinema concession sales.
 *
 * Keys mirror beverageRevenueAccumulators() and venueBeverageRevenueAccumulators(),
 * with the seller-facing two named for the cinema — `cinemaVat` and
 * `cinemaRevenue`. Same reasoning as the venue reader: a cinema's money must
 * never be readable through a field called "organizer".
 */
const cinemaBeverageRevenueAccumulators = () => ({
  grossRevenue: { $sum: "$totalAmount" },
  pazimoCommission: { $sum: COMMISSION_EXPR },
  vatOnCommission: { $sum: VAT_EXPR },
  cinemaVat: { $sum: CINEMA_VAT_EXPR },
  cinemaRevenue: { $sum: CINEMA_SHARE_EXPR },
  unitsSold: { $sum: "$quantity" },
});

const EMPTY_TOTALS = {
  grossRevenue: 0,
  pazimoCommission: 0,
  vatOnCommission: 0,
  cinemaVat: 0,
  cinemaRevenue: 0,
  unitsSold: 0,
  salesCount: 0,
};

/**
 * One cinema's concession totals.
 *
 * Scoped by `cinema`, using { cinema, status, soldAt }. The id is cast here for
 * the same reason the other channels cast: aggregation $match does no schema
 * casting, so a string id silently matches nothing — and a balance that silently
 * reads 0.00 is the worst possible failure mode for a payout.
 */
const getCinemaBeverageRevenue = async (cinemaId, currency = "ETB") => {
  // Required lazily so this file stays importable from models without closing a
  // cycle through the model registry.
  const CinemaBeverageSale = require("../models/CinemaBeverageSale");

  if (!cinemaId || !mongoose.Types.ObjectId.isValid(String(cinemaId))) {
    return { ...EMPTY_TOTALS };
  }

  const cinema =
    cinemaId instanceof mongoose.Types.ObjectId
      ? cinemaId
      : new mongoose.Types.ObjectId(String(cinemaId));

  const [row] = await CinemaBeverageSale.aggregate([
    { $match: { cinema, ...validBeverageSaleMatch(currency) } },
    {
      $group: {
        _id: null,
        salesCount: { $sum: 1 },
        ...cinemaBeverageRevenueAccumulators(),
      },
    },
  ]);

  return {
    grossRevenue: row?.grossRevenue || 0,
    pazimoCommission: row?.pazimoCommission || 0,
    vatOnCommission: row?.vatOnCommission || 0,
    cinemaVat: row?.cinemaVat || 0,
    cinemaRevenue: row?.cinemaRevenue || 0,
    unitsSold: row?.unitsSold || 0,
    salesCount: row?.salesCount || 0,
  };
};

module.exports = {
  CINEMA_VAT_RATE_EXPR,
  CINEMA_VAT_EXPR,
  CINEMA_SHARE_EXPR,
  cinemaBeverageRevenueAccumulators,
  getCinemaBeverageRevenue,
  EMPTY_CINEMA_BEVERAGE_TOTALS: EMPTY_TOTALS,
};
