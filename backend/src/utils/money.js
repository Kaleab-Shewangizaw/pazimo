// Money as integers.
//
// Every figure the ledger stores is an integer number of minor units — cents
// for ETB and USD alike. Floats are not used for money anywhere past this file.
//
// WHY THIS EXISTS
//
// The existing balance code stores and sums floats, then rounds at the end.
// That is survivable while every read recomputes from scratch, because the same
// inputs produce the same rounding each time. It stops being survivable the
// moment a running total is PERSISTED: a stored balance accumulates its own
// rounding error, and there is no later recomputation to wash it out. A ledger
// that drifts by a cent a week is worse than no ledger, because it looks right.
//
// So the boundary is here. Amounts crossing into the ledger are converted once,
// with explicit rounding, and never leave integer arithmetic again until they
// are formatted for display.

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Shift a number by a power of ten WITHOUT going through a float multiply.
 *
 * `1.005 * 100` is 100.49999999999999 in IEEE 754, so rounding it gives 100 and
 * the half-cent vanishes. Re-parsing the decimal exponent instead —
 * Number("1.005e2") — gives exactly 100.5, because the shift happens during
 * decimal string parsing rather than in binary floating point.
 *
 * The split on "e" handles values already in exponent form (1e-7), which would
 * otherwise produce the nonsense string "1e-7e2".
 */
const shiftDecimal = (value, exponent) => {
  const [mantissa, exp] = String(value).split("e");
  return Number(`${mantissa}e${exp ? Number(exp) + exponent : exponent}`);
};

/**
 * Round half AWAY FROM ZERO, tolerating representation error.
 *
 * Math.round breaks ties toward +Infinity, so -0.5 becomes -0 while 0.5 becomes
 * 1 — an asymmetry that would make a refund round differently from the sale it
 * reverses. The tolerance absorbs the last bits of error left by any arithmetic
 * upstream, so a value that is mathematically x.5 but stored as x.4999999999
 * still rounds up.
 */
const TIE_TOLERANCE = 1e-9;
const roundHalfAwayFromZero = (n) => {
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const fraction = abs - whole;
  return sign * (fraction >= 0.5 - TIE_TOLERANCE ? whole + 1 : whole);
};

/**
 * A major-unit amount (145.67 ETB) as integer minor units (14567).
 *
 * Rejects values that cannot be money — NaN, Infinity, null — rather than
 * coercing them to 0, because a silent zero in a ledger is indistinguishable
 * from a genuine zero and impossible to find later.
 */
const toMinor = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Not a money amount: ${JSON.stringify(amount)}`);
  }
  return roundHalfAwayFromZero(shiftDecimal(value, 2));
};

/** Integer minor units back to a major-unit number, for display only. */
const toMajor = (minor) => {
  const value = Number(minor);
  if (!Number.isInteger(value)) {
    throw new TypeError(`Minor units must be an integer: ${JSON.stringify(minor)}`);
  }
  return shiftDecimal(value, -2);
};

/**
 * Apply a rate to an integer amount, staying in integers.
 *
 * Used for commission and VAT, which are the only places the ledger multiplies.
 */
const applyRate = (minor, rate) => {
  const value = Number(rate);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Not a rate: ${JSON.stringify(rate)}`);
  }
  return roundHalfAwayFromZero(minor * value);
};

/**
 * Split one sale into its four parts, in integers, with no residue.
 *
 * The seller's share is computed as the REMAINDER rather than by its own
 * multiplication:
 *
 *     net = gross - commission - vat - ownerVat
 *
 * That is the whole point. If all four were rounded independently they could
 * sum to a cent more or less than the sale, and that cent would have to live
 * somewhere — in practice it lands in whichever figure is read last, so the
 * books disagree depending on the order they are looked at. Deriving the
 * seller's share by subtraction makes the identity
 *
 *     gross === commission + vat + ownerVat + net
 *
 * true by construction, for every sale, forever.
 *
 * `vatRate` is charged on the COMMISSION (a 3% cut costs 3.45%), while
 * `ownerVatRate` is charged on the SALE — the two are different taxes and the
 * asymmetry is deliberate. See config/rates.js.
 */
const splitSale = ({ grossMinor, commissionRate, vatRate, ownerVatRate = 0 }) => {
  const commissionMinor = applyRate(grossMinor, commissionRate);
  const vatMinor = applyRate(commissionMinor, vatRate);
  const ownerVatMinor = applyRate(grossMinor, ownerVatRate);
  const netMinor = grossMinor - commissionMinor - vatMinor - ownerVatMinor;

  return { grossMinor, commissionMinor, vatMinor, ownerVatMinor, netMinor };
};

/** Formats minor units for a human. Display only — never feed this back in. */
const formatMinor = (minor, currency = "ETB") =>
  `${toMajor(minor).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

module.exports = {
  MINOR_UNITS_PER_MAJOR,
  roundHalfAwayFromZero,
  toMinor,
  toMajor,
  applyRate,
  splitSale,
  formatMinor,
};
