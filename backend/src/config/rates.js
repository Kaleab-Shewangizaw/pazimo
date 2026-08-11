// Single source of truth for every rate that moves money between a buyer, an
// organizer and Pazimo. These used to be hardcoded literals scattered across
// financeService, organizerController, adminController and userController,
// which is how the same organizer could show two different balances on two
// different screens. Import from here — never re-type a rate.

// Pazimo's service fee on gross ticket sales.
const COMMISSION_RATE = 0.03;

// Government VAT. It is levied on Pazimo's *commission* (a service fee), not
// on the ticket price itself, so it costs 15% of 3% = 0.45% of gross — and it
// is passed through to the organizer rather than absorbed by Pazimo.
const VAT_RATE = 0.15;
const VAT_ON_COMMISSION_RATE = COMMISSION_RATE * VAT_RATE; // 0.0045

// What actually leaves the organizer's side of a ticket sale: 3% + 0.45%.
const TOTAL_CUT_RATE = COMMISSION_RATE + VAT_ON_COMMISSION_RATE; // 0.0345
const ORGANIZER_SHARE_RATE = 1 - TOTAL_CUT_RATE; // 0.9655

// Share of each gross ticket sale routed to loan repayment while an organizer
// carries an outstanding Pazimo Capital debt.
const DEBT_CUT_RATE = 0.6;

// What an organizer with an active advance keeps: 100% − 60% − 3.45%.
const ORGANIZER_SHARE_WITH_ACTIVE_LOAN = ORGANIZER_SHARE_RATE - DEBT_CUT_RATE; // 0.3655

// Telebirr's cut on withdrawal payouts, passed through to the organizer.
const TELEBIRR_FEE_RATE = 0.02;

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

// Rates as percentages, for the places that store or display them that way.
// Rounded on the way out: 0.03 * 0.15 + 0.03 is 0.034499999999999996 in
// floating point, and `* 100` on that yields 3.4499999999999997 — which would
// be written into the database and shown to users verbatim.
const toPercent = (rate) => Math.round(rate * 10000) / 100;

const COMMISSION_PERCENT = toPercent(COMMISSION_RATE); // 3
const VAT_PERCENT = toPercent(VAT_RATE); // 15
const TOTAL_CUT_PERCENT = toPercent(TOTAL_CUT_RATE); // 3.45
const DEBT_CUT_PERCENT = toPercent(DEBT_CUT_RATE); // 60
const ORGANIZER_SHARE_PERCENT = toPercent(ORGANIZER_SHARE_RATE); // 96.55
const ORGANIZER_SHARE_WITH_ACTIVE_LOAN_PERCENT = toPercent(
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN
); // 36.55

// The canonical breakdown of a gross ticket-sale figure. Every screen that
// shows an organizer or admin "what Pazimo took" should render these fields
// rather than re-deriving them, so commission and VAT always agree.
const splitTicketRevenue = (grossRevenue) => {
  const gross = Number(grossRevenue) || 0;
  const commission = round2(gross * COMMISSION_RATE);
  const vat = round2(gross * VAT_ON_COMMISSION_RATE);
  return {
    grossRevenue: gross,
    pazimoCommission: commission,
    vatOnCommission: vat,
    totalDeduction: round2(commission + vat),
    organizerRevenue: round2(gross * ORGANIZER_SHARE_RATE),
  };
};

// Percentage strings for user-facing copy, so "3.45%" is never typed by hand.
const asPercent = (rate, decimals = 2) =>
  `${Number((rate * 100).toFixed(decimals))}%`;

module.exports = {
  COMMISSION_RATE,
  VAT_RATE,
  VAT_ON_COMMISSION_RATE,
  TOTAL_CUT_RATE,
  ORGANIZER_SHARE_RATE,
  DEBT_CUT_RATE,
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN,
  TELEBIRR_FEE_RATE,
  COMMISSION_PERCENT,
  VAT_PERCENT,
  TOTAL_CUT_PERCENT,
  DEBT_CUT_PERCENT,
  ORGANIZER_SHARE_PERCENT,
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN_PERCENT,
  toPercent,
  round2,
  splitTicketRevenue,
  asPercent,
};
