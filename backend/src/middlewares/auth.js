const jwt = require("jsonwebtoken");
const { UnauthorizedError, ForbiddenError } = require("../errors");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Developer = require("../models/Developer");

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
  if (payload.role === "developer") {
    return Developer.findById(payload.id);
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

// ============================================================================
// TEMP-BYPASS-2026-07-10 — SECURITY DOWNGRADE, RESTORED 2026-09-04
// ----------------------------------------------------------------------------
// First added 2026-07-10 for the same reason, removed 2026-08-20 once it
// looked safe to. It wasn't: the organizer app already published to the
// App Store / Play Store — a completely separate codebase this repo has no
// access to, distinct from the in-development pazimo-organizer-mobile — has
// never sent an auth token on this call, and that app can't be updated (a
// store review cycle) until pazimo-organizer-mobile replaces it. Removing
// the bypass on 2026-08-20 broke every organizer on the live app the moment
// production actually picked up that change today; restoring it is what
// "align it with what we have here" means in practice. Same shape as
// ORGANIZER_LOGIN_OTP_ENABLED in authController.js — a compatibility shim
// for the old app, not a rollback of anything else from 2026-09-04.
//
// GET /api/users/:id falls back to trusting the :id in the URL with NO
// token at all, IF that account's role is admin/organizer. This is a real
// IDOR: anyone who has (or guesses) an organizer/admin's Mongo id can read
// their email/phone/ban status with zero credentials. Customer accounts are
// NOT exposed by this — only admin/organizer, and only on this one route
// (PUT/DELETE/list are untouched). Every use of the fallback path is logged
// below so usage can be audited, and a request that does carry a token is
// still held to the normal protect()+restrictTo() check.
//
// TO REMOVE (once pazimo-organizer-mobile has replaced the old app): delete
// this whole block and the `protectStrictOrTrustParamId` export, then in
// userRoutes.js change the GET /:id route back to:
//   router.get('/:id', protect, restrictTo('admin', 'organizer'), userController.getUser);
// ============================================================================
const protectStrictOrTrustParamId = async (req, res, next) => {
  const token = extractToken(req);

  // Token present: behave exactly like the normal, secure `protect` +
  // restrictTo('admin', 'organizer') pair this route used before the bypass.
  if (token) {
    return protect(req, res, (err) => {
      if (err) return next(err);
      if (!["admin", "organizer"].includes(req.user.role)) {
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to perform this action",
        });
      }
      next();
    });
  }

  // No token at all - fallback for the old app. Trust req.params.id directly.
  try {
    let account = await User.findById(req.params.id);
    if (!account) {
      account = await Admin.findById(req.params.id);
    }

    if (!account || !["admin", "organizer"].includes(account.role)) {
      return next(new UnauthorizedError("Not authorized to access this route"));
    }

    if (account.isActive === false) {
      if (account.isBanned) {
        return next(bannedAccountError(account));
      }
      return next(new UnauthorizedError("Account is not active"));
    }

    console.warn(
      `TEMP-BYPASS-2026-07-10: unauthenticated ${req.method} ${req.originalUrl} allowed through with no token (role=${account.role}).`
    );

    req.user = account;
    next();
  } catch (error) {
    return next(new UnauthorizedError("Not authorized to access this route"));
  }
};
// ============================================================================
// END TEMP-BYPASS-2026-07-10
// ============================================================================

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

module.exports = {
  protect,
  authenticateUser,
  optionalAuth,
  restrictTo,
  isAdmin,
  requireCapitalEligible,
  protectStrictOrTrustParamId, // TEMP-BYPASS-2026-07-10 - remove with the block above
};
