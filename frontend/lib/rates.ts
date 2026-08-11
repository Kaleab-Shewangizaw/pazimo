// Mirror of backend/src/config/rates.js. The backend is authoritative for
// every figure that moves money — this exists so user-facing *copy* ("3.45%",
// "36.55%") is generated from one place instead of being typed into a dozen
// JSX strings that then drift apart when a rate changes.
//
// Never compute a payout from these. Read the amounts the API returns.

export const COMMISSION_RATE = 0.03;
export const VAT_RATE = 0.15;
export const VAT_ON_COMMISSION_RATE = COMMISSION_RATE * VAT_RATE;
export const TOTAL_CUT_RATE = COMMISSION_RATE + VAT_ON_COMMISSION_RATE;
export const ORGANIZER_SHARE_RATE = 1 - TOTAL_CUT_RATE;
export const DEBT_CUT_RATE = 0.6;
export const ORGANIZER_SHARE_WITH_ACTIVE_LOAN =
  ORGANIZER_SHARE_RATE - DEBT_CUT_RATE;

// 0.0345 * 100 is 3.4499999999999997 in floating point — round on the way out
// so no label ever renders a tail of nines.
const toPercent = (rate: number) => Math.round(rate * 10000) / 100;

export const COMMISSION_PERCENT = toPercent(COMMISSION_RATE); // 3
export const VAT_PERCENT = toPercent(VAT_RATE); // 15
export const TOTAL_CUT_PERCENT = toPercent(TOTAL_CUT_RATE); // 3.45
export const DEBT_CUT_PERCENT = toPercent(DEBT_CUT_RATE); // 60
export const ORGANIZER_SHARE_PERCENT = toPercent(ORGANIZER_SHARE_RATE); // 96.55
export const ORGANIZER_SHARE_WITH_ACTIVE_LOAN_PERCENT = toPercent(
  ORGANIZER_SHARE_WITH_ACTIVE_LOAN
); // 36.55

// The one-line explanation of why the deduction is 3.45% and not 3%. Reused
// wherever the cut is shown so the wording stays identical everywhere.
export const VAT_EXPLAINER = `${COMMISSION_PERCENT}% Pazimo commission + ${VAT_PERCENT}% government VAT on that commission`;
