// Short, random pickup codes for a sale — replaces the old sequential
// "PZB-SL-000042" counter on BeverageSale/VenueBeverageSale.
//
// A sequential counter makes every other reference number in the ledger
// guessable from one real one (id 42 tells you id 41 and 43 exist), which is
// the wrong shape for something a stranger hands to a counter to collect a
// paid-for drink. Random draws don't have that property, and a customer
// showing this at a counter (or, eventually, having it scanned off a barcode)
// benefits from it being short rather than descriptive.
//
// Alphabet excludes visually ambiguous characters (0/O, 1/I) since staff may
// need to key a code in by hand when a scanner isn't at hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(length = CODE_LENGTH) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/**
 * A reference number unique within whatever `exists` checks, retrying on the
 * (astronomically unlikely, at 33^6 ≈ 1.3 billion draws) collision rather than
 * trusting a single one. `prefix` keeps the two sales channels visually
 * distinguishable at a glance without needing to look the sale up.
 */
async function generateReferenceNumber(prefix, exists, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = `${prefix}-${randomCode()}`;
    // eslint-disable-next-line no-await-in-loop -- a collision must be observed before the next draw is worth making.
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Could not generate a unique reference number");
}

module.exports = { generateReferenceNumber, randomCode, ALPHABET };
