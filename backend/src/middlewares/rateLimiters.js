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

// Organizer OTP send triggers a real SMS or email send, same cost/abuse
// profile as otpLimiter above.
const organizerOtpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // sends per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many verification code requests. Please wait a few minutes and try again."),
});

// Guards the 6-digit code against brute-forcing. Per-account attempt capping
// already lives in the controller (otpAttempts on the User doc); this is the
// per-IP backstop so one IP can't grind through many different accounts'
// codes even if each individual account isn't maxed out yet.
const organizerOtpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many attempts. Please wait a few minutes and try again."),
});

// Forgot-password send triggers a real SMS or email send, same cost/abuse
// profile as organizerOtpSendLimiter. Shared by the generic and
// organizer-scoped forgot-password routes — same feature, same abuse shape.
const passwordResetSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // sends per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many password reset requests. Please wait a few minutes and try again."),
});

// Guards the reset code against brute-forcing, same shape as
// organizerOtpVerifyLimiter. Per-account attempt capping lives in the
// controller (resetOtpAttempts on the User doc); this is the per-IP backstop.
const passwordResetVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many attempts. Please wait a few minutes and try again."),
});

// Organizer sign-up had no rate limiter at all before 2026-09-03 — public,
// unauthenticated, and accepts a file upload. Same allowance as regular
// registration.
const organizerSignUpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // sign-ups per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many sign-up attempts from this network. Please try again later."),
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

// Guards the admin/staff write surface (categories, invitation pricing, QR
// ticket minting). These sit behind authentication, so this is not the primary
// control — it is the backstop that turns a stolen token or a scripted mistake
// into a few dozen rows rather than a few hundred thousand. Deliberately
// generous, because a real admin doing bulk work must never hit it, and
// per-IP, so one caller can only exhaust their own budget.
const adminWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // writes per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many changes in a short time. Please wait a moment and try again."),
});

// Minting admission QR codes is the one write here that creates something with
// real-world value at the door, so it gets a tighter allowance than the rest of
// the admin write surface even though it is authenticated too.
const qrIssueLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // issue requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many ticket generation requests. Please wait a few minutes and try again."),
});

// Guards the unauthenticated cinema checkout. Each call takes seat locks and
// calls a payment provider, so the abuse this stops is not load but denial of
// sale: a script starting checkouts it never pays for could hold every seat in
// a sold-out screening. Tighter than a read limit for that reason, and generous
// enough that a family retrying a failed payment is never caught.
const cinemaCheckoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 12, // checkout attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler(
    "Too many booking attempts from this network. Please wait a few minutes and try again."
  ),
});

// Recipient search sits behind auth but still lets a caller page through the
// user directory by phone/name/email, so it gets its own (generous) budget
// rather than sharing one with the write endpoints below.
const ticketShareSearchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // searches per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many searches. Please slow down and try again shortly."),
});

// Guards ticket-share create/accept/decline/cancel — authenticated, but a
// stolen token or a scripted mistake should still only be able to spam a
// bounded number of transfers per window.
const ticketShareWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // share actions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many share requests. Please wait a few minutes and try again."),
});

// Guards sending a chat message — a much higher-cadence action than a share
// (real typing, not a deliberate multi-step transfer), so the window is
// short and the ceiling generous rather than mirroring ticketShareWriteLimiter's.
const messageWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 40, // messages per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("You're sending messages too fast. Please slow down."),
});

// Guards a signed-in customer changing their own password against brute-force
// guessing of the current password, same shape/reasoning as loginLimiter.
const updatePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonRateLimitHandler("Too many attempts. Please wait a few minutes and try again."),
});

// Account deletion is permanent and irreversible — tighter than a login
// limiter, since a legitimate user has no reason to hit this often.
const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler("Too many attempts. Please wait a while and try again."),
});

module.exports = {
  cinemaCheckoutLimiter,
  adminWriteLimiter,
  qrIssueLimiter,
  rsvpSubmissionLimiter,
  rsvpPublicReadLimiter,
  loginLimiter,
  adminLoginLimiter,
  registerLimiter,
  otpLimiter,
  organizerOtpSendLimiter,
  organizerOtpVerifyLimiter,
  passwordResetSendLimiter,
  passwordResetVerifyLimiter,
  organizerSignUpLimiter,
  unifiedAuthLimiter,
  ticketShareSearchLimiter,
  ticketShareWriteLimiter,
  messageWriteLimiter,
  updatePasswordLimiter,
  deleteAccountLimiter,
};
