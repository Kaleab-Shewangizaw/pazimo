// Single source of truth for every rate that moves money.
//
// Commission is per event: most run at the 3% default, but a given event can be
// negotiated to 2.5%, 4%, or anything else. VAT is fixed by the government and
// is levied on the commission — Pazimo's service fee — not on the ticket price.
// So an event at 4% actually costs the organizer 4% + 15% of 4% = 4.6%.

const DEFAULT_COMMISSION_RATE = 0.03;

// Guard rails for the admin UI. A typo of 30 instead of 0.30 would quietly take
// a third of an organizer's revenue, so the model validates against these too.
const MIN_COMMISSION_RATE = 0;
const MAX_COMMISSION_RATE = 0.25;

// Government VAT, charged on the commission and passed through to the organizer.
const VAT_RATE = 0.15;

// Telebirr's cut on withdrawal payouts, passed through to the organizer.
const TELEBIRR_FEE_RATE = 0.02;

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

// Percentages for display. 0.03 * 1.15 * 100 is 3.4499999999999997 in floating
// point; rounding here keeps that out of the database and off the screen.
const toPercent = (rate) => Math.round(rate * 10000) / 100;

/** A rate that is a real number inside the allowed band, else the default. */
const normalizeCommissionRate = (rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value)) return DEFAULT_COMMISSION_RATE;
  return Math.min(MAX_COMMISSION_RATE, Math.max(MIN_COMMISSION_RATE, value));
};

/** VAT owed on a given commission rate — 15% of it, not 15% of the ticket. */
const vatRateFor = (commissionRate = DEFAULT_COMMISSION_RATE) =>
  normalizeCommissionRate(commissionRate) * VAT_RATE;

/** Everything deducted from the organizer: commission + VAT on it. */
const totalCutRateFor = (commissionRate = DEFAULT_COMMISSION_RATE) =>
  normalizeCommissionRate(commissionRate) * (1 + VAT_RATE);

/** The organizer's share of a ticket at a given commission rate. */
const organizerShareRateFor = (commissionRate = DEFAULT_COMMISSION_RATE) =>
  1 - totalCutRateFor(commissionRate);

/**
 * Split a gross figure at one commission rate.
 *
 * Only valid when every ticket in `grossRevenue` shares that rate. Across a mix
 * of events, sum per ticket in the aggregation instead — see
 * utils/ticketRevenueQuery.COMMISSION_EXPR.
 */
const splitTicketRevenue = (grossRevenue, commissionRate = DEFAULT_COMMISSION_RATE) => {
  const gross = Number(grossRevenue) || 0;
  const rate = normalizeCommissionRate(commissionRate);
  const commission = round2(gross * rate);
  const vat = round2(gross * rate * VAT_RATE);
  return {
    grossRevenue: gross,
    commissionRate: rate,
    pazimoCommission: commission,
    vatOnCommission: vat,
    totalDeduction: round2(commission + vat),
    organizerRevenue: round2(gross - commission - vat),
  };
};

module.exports = {
  DEFAULT_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
  VAT_RATE,
  TELEBIRR_FEE_RATE,
  round2,
  toPercent,
  normalizeCommissionRate,
  vatRateFor,
  totalCutRateFor,
  organizerShareRateFor,
  splitTicketRevenue,
};
