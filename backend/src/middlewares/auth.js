const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../errors");
const User = require("../models/User");
const Admin = require("../models/Admin");

// A banned account needs to reach the client as a distinct, stable signal
// (not folded into a generic "invalid token" 401) so the frontend can show a
// dedicated "account suspended" screen instead of silently bouncing to login.
const bannedAccountError = (account) => {
  const err = new ForbiddenError(
    account?.banReason || "Your account has been suspended."
  );
  err.code = "ACCOUNT_BANNED";
  return err;
};

// Admins live in their own collection; every other role lives on User.
// Looking the account up for real on every request (instead of trusting
// the JWT's role claim) means a stale or tampered token can never grant
// access that the account no longer has.
const findAccountByPayload = (payload) => {
  if (payload.role === "admin") {
    return Admin.findById(payload.id);
  }
  return User.findById(payload.id);
};

const authenticateUser = async (req, res, next) => {
  let account;
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Authentication invalid");
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    account = await findAccountByPayload(payload);
    if (!account) {
      throw new UnauthorizedError("Authentication invalid");
    }
  } catch (error) {
    return next(new UnauthorizedError("Authentication invalid"));
  }

  // Outside the try/catch above on purpose: a banned account is not a token
  // problem, and must not be reported as one. isActive:false also covers
  // unrelated cases (e.g. an organizer awaiting admin approval), so only
  // isBanned:true gets the ban-specific signal — everything else keeps the
  // original generic rejection.
  if (account.isActive === false) {
    if (account.isBanned) {
      return next(bannedAccountError(account));
    }
    return next(new UnauthorizedError("Authentication invalid"));
  }

  req.user = {
    userId: account._id.toString(),
    role: account.role,
  };

  next();
};

// Attaches req.user when a valid token is present, but never blocks the
// request — used by routes that serve different data to logged-in vs
// anonymous callers (e.g. admins seeing full event data on an otherwise
// public listing endpoint).
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const account = await findAccountByPayload(payload);

    if (account && account.isActive !== false) {
      req.user = {
        userId: account._id.toString(),
        role: account.role,
      };
    }
  } catch (error) {
    // Invalid/expired token: treat the caller as anonymous instead of failing.
  }
  next();
};

// Accepts the credential from a standard `Authorization: Bearer` header or from
// a couple of other places an HTTP client might put it, because the organizer
// mobile app was found (2026-07-10) not to send the standard header on every
// route.
//
// This is tolerance about WHERE the credential is, never about WHETHER there is
// one: every branch below returns a token that still has to survive
// `jwt.verify` against JWT_SECRET, so none of them weakens authentication. The
// part that did weaken it — a no-token fallback that trusted the id in the URL —
// was removed on 2026-08-20; see the note on protect() below.
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }
  if (req.headers["x-access-token"]) {
    return req.headers["x-access-token"];
  }
  if (req.headers["x-auth-token"]) {
    return req.headers["x-auth-token"];
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
};

// Removed 2026-08-20: `protectStrictOrTrustParamId`, the TEMP-BYPASS-2026-07-10
// shim on GET /api/users/:id. When a request carried no token at all it fell
// back to trusting `req.params.id` and returned that account's email, phone and
// ban status to an anonymous caller, as long as the account was an admin or
// organizer — a real IDOR against exactly the highest-value accounts. It was
// meant to last two days and lasted six weeks.
//
// The route now uses `protect` + `restrictTo('admin', 'organizer')`, which is
// what it used before the shim. The mobile app is unaffected as long as it
// sends its token anywhere extractToken looks (Authorization, x-access-token,
// x-auth-token, ?token=); if it truly sends none, the rejection is logged below
// with the URL, which is the signal to fix the app rather than reopen the hole.
const protect = async (req, res, next) => {
  let account;
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError("No token provided");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    account = await findAccountByPayload(decoded);

    if (!account) {
      throw new UnauthorizedError("User not found");
    }
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new UnauthorizedError("Invalid token"));
    }
    if (error.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token expired"));
    }
    // The generic fallback below hides the real cause from the client on
    // purpose, but that also makes it impossible to debug from the outside -
    // log what actually happened (no auth header, bad account id, DB lookup
    // failure, etc.) so a report of this error can be traced to its cause.
    console.error(
      `protect() rejected ${req.method} ${req.originalUrl}: ${error.name}: ${error.message}`
    );
    return next(new UnauthorizedError("Not authorized to access this route"));
  }

  // Outside the try/catch above on purpose: a banned account is not a token
  // problem, and must not be reported as one. isActive:false also covers
  // unrelated cases (e.g. an organizer awaiting admin approval), so only
  // isBanned:true gets the ban-specific signal — everything else keeps the
  // original generic rejection.
  if (account.isActive === false) {
    if (account.isBanned) {
      return next(bannedAccountError(account));
    }
    return next(new UnauthorizedError("Account is not active"));
  }

  req.user = account;
  next();
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

const isAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "partner") {
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin or partner privileges required.",
      });
    }
    next();
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Gates the Pazimo Capital organizer surface. Checked against the database on
// every request rather than any claim on the JWT — same reasoning as
// findAccountByPayload above: eligibility is mutable admin-granted state, and
// a token issued before it was revoked must not keep working.
const requireCapitalEligible = async (req, res, next) => {
  try {
    const OrganizerCapitalProfile = require("../models/OrganizerCapitalProfile");
    const profile = await OrganizerCapitalProfile.findOne({
      organizer: req.user.userId,
    });

    if (!profile || profile.eligibility !== "eligible") {
      return res.status(403).json({
        status: "error",
        message: "You are not eligible for Pazimo Capital.",
      });
    }

    req.capitalProfile = profile;
    next();
  } catch (error) {
    next(new UnauthorizedError("Not authorized to access this route"));
  }
};

// Gates the beverage-selling organizer surface. Same contract (and same
// reasoning) as requireCapitalEligible above: eligibility is mutable
// admin-granted state, so it is read from the database on every request and
// never taken from the JWT.
const requireBeverageEligible = async (req, res, next) => {
  try {
    const OrganizerBeverageProfile = require("../models/OrganizerBeverageProfile");
    const profile = await OrganizerBeverageProfile.findOne({
      organizer: req.user.userId,
    });

    if (!profile || profile.eligibility !== "eligible") {
      return res.status(403).json({
        status: "error",
        message: "You are not eligible to sell beverages at your events.",
      });
    }

    req.beverageProfile = profile;
    next();
  } catch (error) {
    next(new UnauthorizedError("Not authorized to access this route"));
  }
};

// Resolves the venue owned by the calling account and attaches it as req.venue.
//
// Same contract and same reasoning as requireBeverageEligible above: the venue
// and its approval are mutable admin-granted state, so both are read from the
// database on every request and never taken from the JWT. A token issued while
// a venue was approved must stop working the moment approval is withdrawn.
//
// Deliberately does NOT read a venue id from the request. The venue a caller
// may act as is derived from their account and nothing else, so no route behind
// this middleware can be pointed at another venue by changing a parameter.
const requireVenueAccount = async (req, res, next) => {
  try {
    const Venue = require("../models/Venue");
    const venue = await Venue.findOne({ account: req.user.userId });

    if (!venue) {
      return res.status(403).json({
        status: "error",
        message: "This account is not linked to a venue.",
      });
    }
    if (venue.isActive === false) {
      return res.status(403).json({
        status: "error",
        message: "This venue has been suspended.",
      });
    }

    req.venue = venue;
    next();
  } catch (error) {
    next(new UnauthorizedError("Not authorized to access this route"));
  }
};

// Adds the approval check on top. Split from requireVenueAccount because a
// venue must still be able to read its own profile — and be told it is awaiting
// approval — while it is not yet eligible to sell anything.
const requireVenueEligible = async (req, res, next) => {
  requireVenueAccount(req, res, (err) => {
    if (err) return next(err);
    if (!req.venue || req.venue.eligibility !== "eligible") {
      return res.status(403).json({
        status: "error",
        message: "This venue is not approved to sell beverages yet.",
      });
    }
    next();
  });
};

// Resolves the cinema owned by the calling account and attaches it as
// req.cinema. The cinema twin of requireVenueAccount, with the same contract and
// the same reasoning: the cinema and its approval are mutable admin-granted
// state, so both are read from the database on every request and never taken
// from the JWT. A token issued while a cinema was active must stop working the
// moment it is suspended.
//
// Deliberately does NOT read a cinema id from the request. The cinema a caller
// may act as is derived from their account and nothing else, so no route behind
// this middleware can be pointed at another cinema by changing a parameter —
// which is what stops Cinema A editing Cinema B.
const requireCinemaAccount = async (req, res, next) => {
  try {
    const Cinema = require("../models/Cinema");
    const cinema = await Cinema.findOne({ account: req.user.userId });

    if (!cinema) {
      return res.status(403).json({
        status: "error",
        message: "This account is not linked to a cinema.",
      });
    }
    if (cinema.isActive === false) {
      return res.status(403).json({
        status: "error",
        message: "This cinema has been suspended.",
      });
    }

    req.cinema = cinema;
    next();
  } catch (error) {
    next(new UnauthorizedError("Not authorized to access this route"));
  }
};

// Adds the concession-approval check on top. Split from requireCinemaAccount for
// the reason requireVenueEligible is split: a cinema must still be able to read
// its own profile, sell seats, and be told it is awaiting approval, while it is
// not yet eligible to sell drinks and snacks. Selling seats is what a cinema is
// for — only the concession surface is gated.
const requireCinemaBeverageEligible = async (req, res, next) => {
  requireCinemaAccount(req, res, (err) => {
    if (err) return next(err);
    if (!req.cinema || req.cinema.beverageEligibility !== "eligible") {
      return res.status(403).json({
        status: "error",
        message: "This cinema is not approved to sell concessions yet.",
      });
    }
    next();
  });
};

module.exports = {
  protect,
  authenticateUser,
  optionalAuth,
  restrictTo,
  isAdmin,
  requireCapitalEligible,
  requireBeverageEligible,
  requireVenueAccount,
  requireVenueEligible,
  requireCinemaAccount,
  requireCinemaBeverageEligible,
};
