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

// Government VAT, charged on the commission and passed through to the
// organizer — 0 for now.
//
// Held back 2026-09-16 by explicit decision, not an oversight: this was
// written 2026-08-11/13 (see commit fbaeb25 and 3d0d65f) but production has
// never deployed it — every organizer today still sees the old flat 97%
// split, confirmed against a live production dashboard pull. Flipping this
// to 0.15 would be the first time it actually takes real money from every
// organizer, silently, as a side effect of an unrelated deploy — asked, and
// the answer was to hold it back until it can be shipped and communicated on
// its own. Every organizer's split reduces to flat commissionRate (97% at
// the 3% default) while this is 0 — vat/vatOnCommission entries and figures
// stay in every formula and the ledger, they just compute to zero, so
// flipping this back to 0.15 later needs no other code change.
const VAT_RATE = 0;

// VAT on the ORGANIZER's own sales — a different tax from the one above.
//
// Normally this is the organizer's own obligation and never touches Pazimo: a
// licensed organizer declares and remits it themselves. An organizer without a
// VAT licence cannot, so Pazimo can be set to cover the event (see
// Event.coversOrganizerVat): the platform withholds this share of gross ticket
// or bar revenue and remits it to the government on the organizer's behalf.
//
// It is charged on the SALE, not on the commission — so on a 100 ETB ticket at
// 3% the organizer loses 3.00 commission + 0.45 VAT on it + 15.00 organizer
// VAT, and keeps 81.55.
//
// Critically, this money is never Pazimo revenue. It is collected as a
// liability and paid straight out. Anything that reports "what Pazimo earned"
// must exclude it, which is why it is a separate rate and a separate figure
// everywhere rather than a bigger commission percentage.
const ORGANIZER_VAT_RATE = 0.15;

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

/**
 * A withheld organizer-VAT rate: 0 when Pazimo is not covering the event.
 *
 * Snapshots are stored as rates rather than as a boolean so that a future
 * change to ORGANIZER_VAT_RATE cannot restate sales already made at 15%. Old
 * snapshots above the current ceiling keep their own rate; anything absent,
 * negative or unparseable means "not covered".
 */
const normalizeOrganizerVatRate = (rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
};

/** The rate to snapshot onto a sale, from the event's coverage flag. */
const organizerVatRateFor = (coversOrganizerVat) =>
  coversOrganizerVat ? ORGANIZER_VAT_RATE : 0;

/** VAT owed on a given commission rate — 15% of it, not 15% of the ticket. */
const vatRateFor = (commissionRate = DEFAULT_COMMISSION_RATE) =>
  normalizeCommissionRate(commissionRate) * VAT_RATE;

/**
 * Everything deducted from the organizer: commission, VAT on that commission,
 * and — only when Pazimo covers the event — the organizer's own VAT.
 */
const totalCutRateFor = (
  commissionRate = DEFAULT_COMMISSION_RATE,
  organizerVatRate = 0
) =>
  normalizeCommissionRate(commissionRate) * (1 + VAT_RATE) +
  normalizeOrganizerVatRate(organizerVatRate);

/** The organizer's share of a ticket at a given commission rate. */
const organizerShareRateFor = (
  commissionRate = DEFAULT_COMMISSION_RATE,
  organizerVatRate = 0
) => 1 - totalCutRateFor(commissionRate, organizerVatRate);

/**
 * The same figure for display, from an event's coverage flag rather than a
 * rate: 3% reads as 3.45% normally and 18.45% when Pazimo covers the VAT.
 */
const totalCutPercentFor = (commissionRate, coversOrganizerVat) =>
  toPercent(
    totalCutRateFor(commissionRate, organizerVatRateFor(coversOrganizerVat))
  );

/**
 * Split a gross figure at one commission rate.
 *
 * Only valid when every ticket in `grossRevenue` shares that rate and the same
 * VAT-coverage setting. Across a mix of events, sum per ticket in the
 * aggregation instead — see utils/ticketRevenueQuery.COMMISSION_EXPR.
 */
const splitTicketRevenue = (
  grossRevenue,
  commissionRate = DEFAULT_COMMISSION_RATE,
  organizerVatRate = 0
) => {
  const gross = Number(grossRevenue) || 0;
  const rate = normalizeCommissionRate(commissionRate);
  const orgVatRate = normalizeOrganizerVatRate(organizerVatRate);
  const commission = round2(gross * rate);
  const vat = round2(gross * rate * VAT_RATE);
  const organizerVat = round2(gross * orgVatRate);
  return {
    grossRevenue: gross,
    commissionRate: rate,
    organizerVatRate: orgVatRate,
    pazimoCommission: commission,
    vatOnCommission: vat,
    // Withheld for the government, not earned. Kept out of every "Pazimo
    // revenue" figure and reported as its own liability.
    organizerVat,
    totalDeduction: round2(commission + vat + organizerVat),
    organizerRevenue: round2(gross - commission - vat - organizerVat),
  };
};

module.exports = {
  DEFAULT_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
  VAT_RATE,
  ORGANIZER_VAT_RATE,
  TELEBIRR_FEE_RATE,
  round2,
  toPercent,
  normalizeCommissionRate,
  normalizeOrganizerVatRate,
  organizerVatRateFor,
  vatRateFor,
  totalCutRateFor,
  totalCutPercentFor,
  organizerShareRateFor,
  splitTicketRevenue,
};
