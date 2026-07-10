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

// TEMPORARY compat shim (2026-07-10): the organizer app can't be updated
// right now and appears not to send a standard `Authorization: Bearer`
// header on this route, so also accept the token from a couple of other
// common places an HTTP client might put it. Still requires a valid,
// signature-verified JWT either way - this does not weaken auth, it just
// widens where we're willing to look for the credential.
// Remove once the app is confirmed to send a proper Authorization header.
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

module.exports = {
  protect,
  authenticateUser,
  optionalAuth,
  restrictTo,
  isAdmin,
};
