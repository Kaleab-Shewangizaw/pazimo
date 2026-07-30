const rateLimit = require("express-rate-limit");

const jsonRateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    message,
  });
};

// Guards the public, unauthenticated RSVP submission endpoint against
// scripted/bot bursts and retry storms. The threshold is generous per IP
// because many real guests can share one address on venue WiFi/NAT.
const rsvpSubmissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Too many RSVP submissions from this network. Please wait a few minutes and try again."
  ),
});

// Guards public read endpoints (form page load, published-forms feed) from
// scraping/bot bursts without punishing normal browsing or refreshes.
const rsvpPublicReadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many requests. Please slow down and try again shortly."),
});

// Guards password-based login against brute-forcing. Per-IP rather than
// per-account so an attacker can't use failed attempts to lock a real user out.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many login attempts. Please wait a few minutes and try again."),
});

// Admin login is a higher-value target than customer login, so it gets a
// tighter allowance.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many login attempts. Please wait a few minutes and try again."),
});

// Developer login is a high-value target (server internals access) and is
// kept separate from adminLoginLimiter so a burst of failed attempts against
// one role's login can't also lock out that IP's attempts on the other.
const developerLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many login attempts. Please wait a few minutes and try again."),
});

// Guards public account creation from being used to spam-create accounts.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // registrations per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many accounts created from this network. Please try again later."),
});

// OTP sends trigger a real SMS send (cost + abuse vector), so this stays tight.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // OTP sends per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many OTP requests. Please wait a few minutes and try again."),
});

// unified-auth doubles as login/account-creation using the phone number as the
// password, so it gets the same allowance as regular login.
const unifiedAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many attempts. Please wait a few minutes and try again."),
});

module.exports = {
  rsvpSubmissionLimiter,
  rsvpPublicReadLimiter,
  loginLimiter,
  adminLoginLimiter,
  developerLoginLimiter,
  registerLimiter,
  otpLimiter,
  unifiedAuthLimiter,
};
