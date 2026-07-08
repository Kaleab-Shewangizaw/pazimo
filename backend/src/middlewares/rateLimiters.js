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

module.exports = { rsvpSubmissionLimiter, rsvpPublicReadLimiter };
