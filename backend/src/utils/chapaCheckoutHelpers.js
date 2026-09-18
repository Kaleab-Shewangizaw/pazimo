// Shared helpers for the beverage "refill" checkouts (event + venue channels).
//
// Copied from controllers/cinemaCheckoutController.js rather than imported
// from it: two independent Chapa checkout flows sharing one module would mean
// an edit made for one channel's benefit can silently change behaviour for
// the other. Cinema's checkout is a live, load-bearing payment path — this
// file exists so beverage checkout can reuse the same logic without ever
// being able to regress it.

/**
 * The base URL a payment provider can actually reach us on.
 *
 * A webhook URL that resolves to localhost is accepted by the provider and
 * then never called, so the payment succeeds and the order never settles —
 * the worst possible failure, because the customer has paid.
 */
const resolveWebhookBaseUrl = (req) => {
  const explicitPublicUrl =
    process.env.CHAPA_WEBHOOK_BASE_URL || process.env.BACKEND_PUBLIC_URL;
  if (explicitPublicUrl) return explicitPublicUrl.replace(/\/$/, "");

  const configuredBackendUrl = process.env.BACKEND_URL;
  if (configuredBackendUrl && !/localhost|127\.0\.0\.1/i.test(configuredBackendUrl)) {
    return configuredBackendUrl.replace(/\/$/, "");
  }

  const forwardedHost = req?.headers?.["x-forwarded-host"];
  if (forwardedHost && !/localhost|127\.0\.0\.1/i.test(forwardedHost)) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    return `${protocol}://${forwardedHost}`.replace(/\/$/, "");
  }

  return (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");
};

/**
 * Turn whatever a payment provider threw into a sentence a customer can read.
 *
 * Chapa reports validation failures as an OBJECT keyed by field
 * ({ email: ["validation.email"] }) — passing that straight through produces
 * the literal string "[object Object]", which tells a customer nothing.
 */
const describePaymentError = (error) => {
  if (!error) return null;
  if (typeof error === "string") return error;

  const candidates = [
    error.message,
    error.data?.message,
    error.response?.data?.message,
    error.reason,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const text = candidate.trim();
      if (text && text !== "[object Object]") return text;
      continue;
    }
    if (candidate && typeof candidate === "object") {
      const parts = Object.entries(candidate).map(
        ([field, detail]) =>
          `${field}: ${Array.isArray(detail) ? detail.join(", ") : detail}`
      );
      if (parts.length) {
        return `The payment provider rejected the request (${parts.join("; ")})`;
      }
    }
  }

  return null;
};

/**
 * Map the method a customer picked onto what Chapa calls it.
 *
 * MOBILE MONEY (telebirr, M-Pesa, CBE, Awash) is a DIRECT CHARGE — Chapa
 * pushes a prompt to the customer's phone and the browser/app never leaves
 * the checkout, so there is no URL to redirect to and the client has to poll.
 * CARDS need Chapa's hosted page, because card entry and 3-D Secure cannot
 * happen on our own form.
 */
const resolveChapaMethod = (method) => {
  const input = String(method || "").toLowerCase().trim();

  if (input === "visa" || input === "mastercard" || input === "card") {
    return { useWebCheckout: true, chapaType: null };
  }
  if (input === "mpesa") return { useWebCheckout: false, chapaType: "mpesa" };
  if (input === "telebirr") return { useWebCheckout: false, chapaType: "telebirr" };
  if (input.includes("cbe")) return { useWebCheckout: false, chapaType: "cbebirr" };
  if (input.includes("awash")) return { useWebCheckout: false, chapaType: "awashbirr" };
  if (input === "amole") return { useWebCheckout: false, chapaType: "Amole" };
  if (input.includes("boa") || input.includes("abyssinia")) {
    return { useWebCheckout: false, chapaType: "boa_ussd" };
  }
  return { useWebCheckout: false, chapaType: "telebirr" };
};

/** Chapa wants 09…/07…, never +251… — used for both charge shapes. */
const toEthiopianMobile = (phone) => {
  let mobile = String(phone || "").replace(/[\s+]/g, "");
  if (mobile.startsWith("251")) mobile = `0${mobile.substring(3)}`;
  return mobile;
};

module.exports = {
  resolveWebhookBaseUrl,
  describePaymentError,
  resolveChapaMethod,
  toEthiopianMobile,
};
