/**
 * Several catch-all error responses echo `error.message` straight to the
 * client with no guard. `new Error(null)`/`new Error(undefined)` (or any
 * `CustomError` subclass, which all forward to `Error`'s own constructor)
 * stringify to the literal text "null"/"undefined" — a real, non-empty
 * string that looks exactly like a legitimate message but isn't one.
 */
const JUNK_MESSAGES = new Set(["null", "undefined", "[object object]"]);

function safeErrorMessage(error, fallback) {
  const message = error && typeof error.message === "string" ? error.message.trim() : "";
  if (!message || JUNK_MESSAGES.has(message.toLowerCase())) return fallback;
  return message;
}

module.exports = { safeErrorMessage };
