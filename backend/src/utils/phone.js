// Phone numbers are stored as free-form strings today (see User.phoneNumber's
// validator — anything matching /^\+?[\d\s-]{10,}$/ is accepted), so the same
// real number can be on file as "0912345678", "+251912345678" or
// "251912345678". Exact-match search (see ticketShareService.searchRecipients)
// needs one canonical form to compare against, which is what this produces.
//
// Ethiopia (251) is the default country when a number is given in local
// "0..." form, since that is Pazimo's home market — a number that already
// carries a country code (leading "+" or "00") is normalized as international
// and left alone otherwise.
const DEFAULT_COUNTRY_CODE = "251";

// Normalizes to "+<countrycode><nationalnumber>", or null if `raw` doesn't
// look like a real phone number once formatting is stripped.
const normalizePhone = (raw, defaultCountryCode = DEFAULT_COUNTRY_CODE) => {
  if (!raw) return null;
  let digits = String(raw).trim().replace(/[\s\-().]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // Local format, e.g. 0912345678 -> 251912345678
    digits = defaultCountryCode + digits.slice(1);
  } else if (!digits.startsWith(defaultCountryCode)) {
    // A bare national number with no leading 0 (e.g. 912345678) — still
    // local, just missing the trunk prefix.
    digits = defaultCountryCode + digits;
  }

  if (!/^\d{8,15}$/.test(digits)) return null;
  return `+${digits}`;
};

module.exports = { normalizePhone, DEFAULT_COUNTRY_CODE };
