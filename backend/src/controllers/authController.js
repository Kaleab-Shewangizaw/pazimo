const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");
const { UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { isPhoneBanned, normalizePhone, phoneVariants } = require("../utils/fraudGuard");
const { isQueryOperatorInjection } = require("../utils/rejectQueryOperators");
const { stripAngleBrackets } = require("../utils/stripHtml");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const pushService = require("../services/pushService");

const signToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Register user
const register = async (req, res) => {
  try {
    // Whitelist allowed fields — never trust role from the client
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    // Same injection guard as login/unifiedAuth — these fields feed straight
    // into a User.create() whose values are echoed into indexed fields, so a
    // query-operator object must never reach it unvalidated.
    if (
      isQueryOperatorInjection(email) ||
      isQueryOperatorInjection(phoneNumber) ||
      isQueryOperatorInjection(firstName) ||
      isQueryOperatorInjection(lastName)
    ) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Invalid request",
      });
    }

    if (!firstName || !phoneNumber || !password) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "First name, phone number and password are required",
      });
    }

    // Block ban evasion: a banned user can't dodge their ban by signing up
    // again with a new email but the same real phone number (differently
    // formatted or not — isPhoneBanned normalizes across "0.../ +251.../251...").
    if (phoneNumber && (await isPhoneBanned(phoneNumber))) {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        code: "PHONE_BANNED",
        message: "This phone number is not permitted to create an account.",
      });
    }

    // Email is optional from the client; a placeholder keeps the schema's
    // required+unique constraint satisfied the same way unifiedAuth's guest
    // path already does, so a no-email signup is still a normal, fully
    // phone-loggable-in customer account.
    const trimmedEmail = typeof email === "string" ? email.trim() : "";
    const resolvedEmail =
      trimmedEmail ||
      "customerpazimo" +
        String(Math.floor(Math.random() * 1000000)).padStart(6, "0") +
        "@gmail.com";

    const user = await User.create({
      email: resolvedEmail,
      password,
      firstName: stripAngleBrackets(firstName),
      lastName: stripAngleBrackets(lastName),
      phoneNumber,
      role: 'customer',
    });

    // Gated the same way as ORGANIZER_LOGIN_OTP_ENABLED below, and for the
    // identical reason: any pazimo-mobile install from before this shipped
    // (added 2026-09-16) has no idea what to do with a `requiresOtp` reply
    // from /register — it expects an immediate token. Flip
    // REGISTER_PHONE_OTP_ENABLED=true once that build has actually reached
    // users; until then this endpoint behaves exactly as it always has.
    if (process.env.REGISTER_PHONE_OTP_ENABLED === "true") {
      // The account exists but is unverified — no token yet. The client
      // completes sign-up with POST /api/auth/verify-register-otp using the
      // email below and the code just sent, which issues the token. Same
      // requiresOtp/maskedDestination response shape as the login second
      // factor below, so the mobile client's existing OTP-entry step covers
      // both.
      const maskedDestination = await generateAndSendOtp(user, "sms", "register");
      return res.status(StatusCodes.CREATED).json({
        status: "success",
        requiresOtp: true,
        data: {
          email: user.email,
          channel: "sms",
          maskedDestination,
        },
      });
    }

    const token = signToken(user._id, user.role);
    res.status(StatusCodes.CREATED).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          isPhoneVerified: user.isPhoneVerified,
        },
        token,
      },
    });
  } catch (error) {
    // Duplicate email/phone: hand back a clean, branchable error instead of
    // the raw E11000 text, so the client can offer "log in instead" rather
    // than just showing a Mongo error message. Mirrors unifiedAuth's same
    // keyPattern check below.
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(StatusCodes.CONFLICT).json({
          status: "error",
          code: "EMAIL_TAKEN",
          message: "That email is already registered — log in instead.",
        });
      }
      if (error.keyPattern && error.keyPattern.phoneNumber) {
        return res.status(StatusCodes.CONFLICT).json({
          status: "error",
          code: "PHONE_TAKEN",
          message: "That phone number is already registered — log in instead.",
        });
      }
    }
    res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: error.message,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // `identifier` accepts either an email or a phone number; `email` is
    // kept as a fallback for backward compatibility with any caller still
    // sending the old field name.
    const { email, password, identifier: rawIdentifier } = req.body;
    const identifier = String(rawIdentifier ?? email ?? "").trim();

    // See rejectQueryOperators.js: identifier/password must be plain strings
    // before either reaches a query or bcrypt, or a query-operator object
    // (e.g. `{"$ne": null}`) turns the lookup into "match any account".
    if (isQueryOperatorInjection(identifier) || isQueryOperatorInjection(password)) {
      throw new UnauthorizedError("Invalid credentials");
    }
    if (!identifier || !password) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // findUserByIdentifier (below) already knows how to tell an email from
    // a phone number and match a phone across stored formats — the same
    // lookup the forgot-password flow uses.
    const user = await findUserByIdentifier(identifier, null, "+password");
    if (!user) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check if user is active. isActive:false covers two unrelated cases —
    // a fraud ban (isBanned:true) and a not-yet-approved organizer account —
    // so only the former gets the ban code/messaging.
    if (!user.isActive) {
      if (user.isBanned) {
        return res.status(StatusCodes.FORBIDDEN).json({
          status: "error",
          code: "ACCOUNT_BANNED",
          message: user.banReason || "Your account has been suspended.",
        });
      }
      return res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        message: "Your account is not active. Please contact your administrator.",
      });
    }

    // Organizers get a mandatory second factor after the password check —
    // added 2026-09-04, alongside the standalone "sign in with a code"
    // path (sendOrganizerOtp/verifyOrganizerOtp). Password proves the
    // credential; the code proves this request also has the organizer's
    // phone/email in hand. No token is issued yet — the client completes
    // the sign-in with POST /api/auth/organizer/verify-otp using the email
    // below and the code just sent, which is the same endpoint the
    // standalone flow already uses. The destination always comes from
    // `user.phoneNumber`/`user.email` on the account just authenticated by
    // password, never from anything in the request body.
    //
    // Gated off by default as of 2026-09-04: pazimo-organizer-mobile is
    // already live and can't be updated for ~1 week (app-store review
    // takes that long), and it doesn't know how to handle `requiresOtp`
    // yet — turning this on unconditionally would lock every organizer out
    // of the mobile app. Everything else from the 2026-09-04 hardening
    // pass (injection guards, IDOR fixes, rate limiters, mass-assignment
    // fix, data-exposure fixes) stays on; only this one flag is off.
    // Set ORGANIZER_LOGIN_OTP_ENABLED=true (and restart) once the mobile
    // app ships OTP support — no code change needed to re-enable.
    //
    // `user.otpEnabled` (added 2026-09-16) is the unrelated, per-account
    // path: any customer who has turned on login codes in account settings
    // gets the same second factor regardless of this env flag. Settings
    // only lets otpEnabled be set true once isPhoneVerified is true (see
    // updateOtpPreference), so this never sends a code to an unconfirmed
    // number.
    const organizerForcedOtp =
      user.role === "organizer" && process.env.ORGANIZER_LOGIN_OTP_ENABLED === "true";
    if (organizerForcedOtp || user.otpEnabled) {
      const maskedDestination = await generateAndSendOtp(user, "sms");
      return res.status(StatusCodes.OK).json({
        status: "success",
        requiresOtp: true,
        data: {
          email: user.email,
          channel: "sms",
          maskedDestination,
        },
      });
    }

    // Generate token
    const token = signToken(user._id, user.role);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          isPhoneVerified: user.isPhoneVerified,
          otpEnabled: user.otpEnabled,
          // Only ever set for role "cashier" — which single business this
          // login is scoped to. The frontend cashier surfaces (cinema/venue
          // scanner + sales-history pages) read this to know which
          // /api/cinemas/me/* or /api/venues/:venueId/* to call, since a
          // cashier cannot reach the owner-only profile endpoints
          // (GET /me) that would otherwise answer that question.
          cinema: user.cinema || null,
          venue: user.venue || null,
        },
        token,
      },
    });
  } catch (error) {
    res.status(StatusCodes.UNAUTHORIZED).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      throw new UnauthorizedError("User not authenticated");
    }
    const Model = req.user.role === "admin" ? Admin : User;
    const user = await Model.findById(req.user._id).select("-password");
    res.status(StatusCodes.OK).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: error.message,
    });
  }
};

// Update password
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!req.user || !req.user._id) {
      throw new UnauthorizedError("User not authenticated");
    }

    const user = await User.findById(req.user._id);

    // Check current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(StatusCodes.OK).json({
      status: "success",
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: error.message,
    });
  }
};

// Update profile
// const updateProfile = async (req, res) => {
//   try {
//     const { name, email } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.user._id,
//       { name, email },
//       { new: true, runValidators: true }
//     ).select('-password');

//     res.status(StatusCodes.OK).json({
//       status: 'success',
//       data: user,
//     });
//   } catch (error) {
//     res.status(StatusCodes.BAD_REQUEST).json({
//       status: 'error',
//       message: error.message,
//     });
//   }
// };
// Update profile
const updateProfile = async (req, res) => {
  try {
    // Phone number is not editable here (it's the user's verified login
    // identifier) — only accept name and email changes.
    const { firstName, lastName, email } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    // Check if email is already taken by another user — only when an email
    // was actually submitted. An undefined `email` here would otherwise match
    // Mongoose's own "field doesn't exist" semantics and can find an unrelated
    // user, wrongly blocking a name-only edit.
    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "Email is already taken",
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, email },
      { new: true, runValidators: true },
    ).select("-password");

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Notification preferences — stored only for now. There's no push-token/device
// registration in this backend yet, so these flags don't gate any delivery yet;
// they exist so the mobile settings screen has something real to read and
// write while that infrastructure gets built.
const getNotificationPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const user = await User.findById(req.user._id).select("notificationPreferences");
    res.status(200).json({
      status: "success",
      data: user.notificationPreferences,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const updateNotificationPreferences = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    // Whitelist exactly these three keys — never trust the body wholesale
    // into a $set on the account document.
    const update = {};
    for (const key of ["ticketUpdates", "chatMessages", "promotions"]) {
      if (typeof req.body[key] === "boolean") {
        update[`notificationPreferences.${key}`] = req.body[key];
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true },
    ).select("notificationPreferences");

    res.status(200).json({
      status: "success",
      data: user.notificationPreferences,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Registers this device's Expo push token against the signed-in account —
// called on every app launch/relaunch, not just first install, since a
// token can rotate. Idempotent (see pushService.registerPushToken), so a
// duplicate call from a re-mounted screen is harmless.
const registerPushToken = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "A push token is required",
      });
    }

    await pushService.registerPushToken({ userId: req.user._id, token });
    res.status(200).json({ status: "success" });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Called best-effort on sign-out — this device stops receiving this
// account's pushes without needing to wait for Expo to report it dead.
const unregisterPushToken = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const token = typeof req.body.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      return res.status(400).json({
        status: "error",
        message: "A push token is required",
      });
    }

    await pushService.unregisterPushToken({ userId: req.user._id, token });
    res.status(200).json({ status: "success" });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Claims/changes the caller's Telegram-style @username, used for exact-match
// recipient search when sharing a ticket (see ticketShareService). Format is
// enforced again here even though the schema already validates it, so a bad
// value is rejected with a clear message instead of the generic Mongoose
// ValidationError text.
const updateUsername = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const username = String(req.body.username || "").trim().toLowerCase();

    if (!/^[a-z0-9_]{4,20}$/.test(username)) {
      return res.status(400).json({
        status: "error",
        message:
          "Username must be 4-20 characters and contain only lowercase letters, numbers and underscores",
      });
    }

    const taken = await User.findOne({
      username,
      _id: { $ne: req.user._id },
    }).select("_id");
    if (taken) {
      return res.status(409).json({
        status: "error",
        message: "That username is already taken",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username },
      { new: true, runValidators: true },
    ).select("-password");

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: "error",
        message: "That username is already taken",
      });
    }
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Add new method to update phone number
const updatePhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const userId = req.user.id;

    // Check if phone number is already registered
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        status: "error",
        message: "Phone number already registered",
      });
    }

    // Update user's phone number
    const user = await User.findByIdAndUpdate(
      userId,
      {
        phoneNumber,
        isPhoneVerified: false, // Reset verification status when phone number changes
      },
      { new: true, runValidators: true },
    );

    user.password = undefined;

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Sends a phone-verification code to the signed-in user's own number —
// the settings-screen counterpart to the code registration now sends
// automatically. Needed for any account created before this feature (every
// existing customer shows isPhoneVerified:false) that wants to turn on login
// codes. Shares the register-purpose OTP fields with verify-register-otp:
// "prove you own this phone" is the same claim either way, just reached from
// a different entry point (unauthenticated right after sign-up vs.
// authenticated from account settings).
const sendPhoneVerifyOtp = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: "error", message: "User not authenticated" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    if (user.isPhoneVerified) {
      return res.status(200).json({
        status: "success",
        alreadyVerified: true,
        message: "Your phone number is already verified.",
      });
    }

    const maskedDestination = await generateAndSendOtp(user, "sms", "register");
    res.status(200).json({
      status: "success",
      channel: "sms",
      maskedDestination,
      message: `We sent a verification code to ${maskedDestination}.`,
    });
  } catch (error) {
    console.error("Send phone verify OTP error:", error);
    res.status(500).json({ status: "error", message: "Failed to send verification code" });
  }
};

// Verifies the code sendPhoneVerifyOtp just sent. Real check against the
// hashed, expiring, attempt-capped code on the user's own document — this
// used to be a stub that accepted any code unconditionally, but nothing
// ever called it (verify-phone-otp was never routed), so there is no prior
// behavior to preserve.
const verifyPhoneNumber = async (req, res) => {
  try {
    const { code } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: "error", message: "User not authenticated" });
    }
    if (isQueryOperatorInjection(code) || !code) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.registerOtpCodeHash || !user.registerOtpExpires) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (user.registerOtpExpires < Date.now()) {
      user.registerOtpCodeHash = undefined;
      user.registerOtpExpires = undefined;
      user.registerOtpAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (user.registerOtpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        status: "error",
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    const submittedHash = crypto.createHash("sha256").update(String(code)).digest("hex");
    if (submittedHash !== user.registerOtpCodeHash) {
      user.registerOtpAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    user.registerOtpCodeHash = undefined;
    user.registerOtpExpires = undefined;
    user.registerOtpAttempts = 0;
    user.isPhoneVerified = true;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          isPhoneVerified: user.isPhoneVerified,
          otpEnabled: user.otpEnabled,
        },
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    // console.log('Admin login attempt:', req.body); // Debug log

    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      // console.log('Missing email or password'); // Debug log
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password",
      });
    }

    // See rejectQueryOperators.js — this is the query that guards the single
    // admin account, so it gets the same string-only check as the others.
    if (isQueryOperatorInjection(email) || isQueryOperatorInjection(password)) {
      return res.status(400).json({
        status: "error",
        message: "Please provide email and password",
      });
    }

    // Admins live exclusively in the Admin collection - there is no API that
    // creates one, so this is the only account type that can ever match here.
    const admin = await Admin.findOne({ email }).select("+password");
    if (admin && (await admin.comparePassword(password))) {
      if (!admin.isActive) {
        // Admins have no fraud-ban concept (no isBanned/banReason on the
        // Admin model) — a deactivated admin is just deactivated.
        return res.status(403).json({
          status: "error",
          message: "Access denied. Account is not active.",
        });
      }

      admin.lastLogin = Date.now();
      await admin.save({ validateBeforeSave: false });

      const token = signToken(admin._id, admin.role);
      admin.password = undefined;

      return res.status(200).json({
        status: "success",
        token,
        data: { user: admin },
      });
    }

    // Partners are business accounts stored on the User model.
    const partner = await User.findOne({ email, role: "partner" }).select("+password");
    if (!partner || !(await partner.comparePassword(password))) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password",
      });
    }

    if (!partner.isActive) {
      if (partner.isBanned) {
        return res.status(403).json({
          status: "error",
          code: "ACCOUNT_BANNED",
          message: partner.banReason || "Your account has been suspended.",
        });
      }
      return res.status(403).json({
        status: "error",
        message: "Access denied. Account is not active.",
      });
    }

    partner.lastLogin = Date.now();
    await partner.save({ validateBeforeSave: false });

    const token = signToken(partner._id, partner.role);
    partner.password = undefined;

    res.status(200).json({
      status: "success",
      token,
      data: { user: partner },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// ... keep all existing functions (register, login, getMe, etc.)
// isAdmin middleware lives in ../middlewares/auth.js - not duplicated here.

// Send OTP
const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (isQueryOperatorInjection(phoneNumber) || !phoneNumber) {
      return res.status(400).json({
        error: true,
        message: "A valid phone number is required",
      });
    }

    const response = await fetch(
      `https://api.geezsms.com/api/v1/sms/otp?token=${
        process.env.GEEZSMS_API_KEY || "aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw"
      }&shortcode_id=825&phone=${encodeURIComponent(phoneNumber)}`,
    );
    const result = await response.json();

    if (result.error || result.data?.error !== false) {
      return res.status(400).json({
        error: true,
        message: "Failed to send OTP",
      });
    }

    res.status(200).json({
      error: false,
      code: result.code,
      message: "OTP sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
    });
  }
};

// Organizer OTP login (added 2026-09-03) — a second login path for
// organizers alongside the existing email+password login. Sends a 6-digit
// code by SMS by default, or by email if the organizer picks that channel
// (e.g. the SMS doesn't arrive). Deliberately self-managed — generated,
// hashed and checked here — rather than relying on the SMS gateway's own
// OTP+verify pair: nothing in this codebase ever called a matching verify
// endpoint for sendOtp() above, and there's no way to confirm that flow
// actually works end to end without spending real SMS credits against an
// undocumented contract.
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Masks a destination for display in the "we sent a code to ___" UI copy.
// Trade-off, made deliberately: returning this only when the account exists
// means the send-otp response is no longer perfectly silent about account
// existence (a caller can tell a real organizer email from a fake one by
// whether maskedDestination comes back) — narrower than the old fully-generic
// response, but this exact masked-number UI was asked for directly. Every
// other property (rate limiting, no code delivered anywhere but the real
// channel, hashed storage) is unchanged.
// International format with both ends visible — "+2519******44" — per
// direct request 2026-09-04 (was local format, first 2 digits only).
const maskPhoneForDisplay = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  const subscriber = digits.startsWith("251")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;
  if (!subscriber) return null;
  if (subscriber.length <= 4) return "+251" + "*".repeat(subscriber.length);
  const first = subscriber.slice(0, 1);
  const last = subscriber.slice(-2);
  const middle = "*".repeat(subscriber.length - 3);
  return `+251${first}${middle}${last}`;
};

const maskEmailForDisplay = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return null;
  const [name, domain] = email.split("@");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
};

// Which User fields a code is written to, keyed by what the code is proving.
// "login" (organizer sign-in, both the standalone code path and the
// password path's mandatory second factor) and "reset" (forgot-password,
// added 2026-09-03) are kept in entirely separate fields so a code issued
// for one purpose can never be replayed against the other's verify
// endpoint — a leaked/guessed reset code can't be used to sign in, and a
// sign-in code can't be used to change the password.
const OTP_FIELDS_BY_PURPOSE = {
  login: { hash: "otpCodeHash", expires: "otpExpires", attempts: "otpAttempts" },
  reset: { hash: "resetOtpCodeHash", expires: "resetOtpExpires", attempts: "resetOtpAttempts" },
  register: {
    hash: "registerOtpCodeHash",
    expires: "registerOtpExpires",
    attempts: "registerOtpAttempts",
  },
};

// Shared by sendOrganizerOtp (the standalone "sign in with a code" path),
// login (the password path's mandatory second factor for organizers, added
// 2026-09-04), and the forgot-password flow below. Generates the code,
// hashes+stores it on the exact user document passed in — never re-looked-up
// from client input at send time — so the destination is always the one
// actually on that account, never something a caller could redirect by
// supplying a different email/phone in the request body.
const generateAndSendOtp = async (user, channel, purpose = "login") => {
  const fields = OTP_FIELDS_BY_PURPOSE[purpose];
  const code = crypto.randomInt(100000, 1000000).toString();
  user[fields.hash] = crypto.createHash("sha256").update(code).digest("hex");
  user[fields.expires] = Date.now() + OTP_TTL_MS;
  user[fields.attempts] = 0;
  await user.save({ validateBeforeSave: false });

  const maskedDestination =
    channel === "email"
      ? maskEmailForDisplay(user.email)
      : maskPhoneForDisplay(user.phoneNumber);

  // SMS wording below is explicit "PAZIMO OTP:" / "Do not share it with
  // anyone" per direct request 2026-09-04 — NOTE this is close to the exact
  // phrasing confirmed EARLIER THE SAME DAY to be accepted by GeezSMS
  // (dashboard shows "Sent") but never delivered to the handset, while the
  // ticket-confirmation-style wording this replaced was confirmed to
  // deliver. Re-test actual phone delivery after this ships — don't trust
  // "Sent" status alone. If it silently stops arriving again, reverting to
  // the ticket-style phrasing (git history) is the known-working fallback.
  const copy =
    purpose === "reset"
      ? {
          emailSubject: "Your Pazimo password reset code",
          emailHtml: `<p>Your Pazimo password reset code is <strong>${code}</strong>. It expires in 10 minutes. If you didn't request this, you can ignore this message — your password won't change unless this code is used.</p>`,
          sms: `PAZIMO OTP: ${code}\nUse this code to reset your Pazimo account password. Do not share it with anyone.`,
        }
      : purpose === "register"
        ? {
            emailSubject: "Your Pazimo verification code",
            emailHtml: `<p>Your Pazimo verification code is <strong>${code}</strong>. It expires in 10 minutes. Never share this code with anyone.</p>`,
            sms: `PAZIMO OTP: ${code}\nUse this code to verify your phone number on Pazimo. Do not share it with anyone.`,
          }
        : {
            emailSubject: "Your Pazimo verification code",
            emailHtml: `<p>Your Pazimo verification code is <strong>${code}</strong>. It expires in 10 minutes. Never share this code with anyone.</p>`,
            sms: `PAZIMO OTP: ${code}\nUse this code to sign in to your Pazimo account. Do not share it with anyone.`,
          };

  // Fire-and-forget — the caller's response doesn't wait on the SMTP round
  // trip. Zoho (smtp.zoho.com), same transporter shape as
  // ticketConfirmationEmail.js/invitationEmailController.js/contactController.js,
  // not the old ad-hoc Gmail account: a verification code should come from
  // admin@pazimo.com, not a personal-looking Gmail address.
  if (channel === "email") {
    if (!process.env.EMAIL_USER_ZOHO || !process.env.EMAIL_PASS_ZOHO) {
      console.error(`Failed to send ${purpose} OTP email: EMAIL_USER_ZOHO/EMAIL_PASS_ZOHO env vars are required`);
    } else {
      const transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER_ZOHO,
          pass: process.env.EMAIL_PASS_ZOHO,
        },
      });
      transporter
        .sendMail({
          from: `Pazimo <${process.env.EMAIL_USER_ZOHO}>`,
          to: user.email,
          subject: copy.emailSubject,
          html: copy.emailHtml,
        })
        .catch((err) => console.error(`Failed to send ${purpose} OTP email:`, err));
    }
  } else {
    const { sendSMS } = require("../utils/sms");
    sendSMS(user.phoneNumber, copy.sms).catch((err) =>
      console.error(`Failed to send ${purpose} OTP SMS:`, err)
    );
  }

  return maskedDestination;
};

const sendOrganizerOtp = async (req, res) => {
  try {
    const { email, channel } = req.body;

    if (isQueryOperatorInjection(email) || !email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    const deliveryChannel = channel === "email" ? "email" : "sms";

    // Never hand out a working code for an account that isn't allowed to log
    // in anyway (banned or still pending admin approval) — same principle as
    // forgotPassword. Unlike forgotPassword, "account not found" here isn't
    // fully hidden — see maskPhoneForDisplay's comment above.
    const organizer = await User.findOne({ email, role: "organizer" });
    if (!organizer || !organizer.isActive) {
      return res.status(404).json({
        status: "error",
        message: "No organizer account found with that email.",
      });
    }

    const maskedDestination = await generateAndSendOtp(organizer, deliveryChannel);

    return res.status(200).json({
      status: "success",
      channel: deliveryChannel,
      maskedDestination,
      message: `We sent a verification code to ${maskedDestination}.`,
    });
  } catch (error) {
    console.error("Send organizer OTP error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send verification code",
    });
  }
};

// Despite the /organizer/ path, this also verifies the login code sent to
// any customer who has turned on otpEnabled (see login()'s comment above) —
// pazimo-mobile's AuthSheet calls this same endpoint for both. Widened
// 2026-09-16 from `{email, role:"organizer"}` to a plain email lookup for
// that reason; every message below was already role-generic, so this is not
// a behavior change for organizers.
const verifyOrganizerOtp = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (
      isQueryOperatorInjection(email) ||
      isQueryOperatorInjection(code) ||
      !email ||
      !code
    ) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    const organizer = await User.findOne({ email });
    if (!organizer || !organizer.otpCodeHash || !organizer.otpExpires) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (organizer.otpExpires < Date.now()) {
      organizer.otpCodeHash = undefined;
      organizer.otpExpires = undefined;
      organizer.otpAttempts = 0;
      await organizer.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (organizer.otpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        status: "error",
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    const submittedHash = crypto.createHash("sha256").update(String(code)).digest("hex");
    if (submittedHash !== organizer.otpCodeHash) {
      organizer.otpAttempts += 1;
      await organizer.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    // Correct code — single use: clear it before issuing a token so it can't
    // be replayed.
    organizer.otpCodeHash = undefined;
    organizer.otpExpires = undefined;
    organizer.otpAttempts = 0;
    organizer.lastLogin = Date.now();
    await organizer.save({ validateBeforeSave: false });

    // Re-check isActive/isBanned: the code could have been requested before
    // an admin banned the account and verified after. Same messaging as
    // password login.
    if (!organizer.isActive) {
      if (organizer.isBanned) {
        return res.status(StatusCodes.FORBIDDEN).json({
          status: "error",
          code: "ACCOUNT_BANNED",
          message: organizer.banReason || "Your account has been suspended.",
        });
      }
      return res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        message: "Your account is not active. Please contact your administrator.",
      });
    }

    const token = signToken(organizer._id, organizer.role);
    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        user: {
          _id: organizer._id,
          id: organizer._id,
          firstName: organizer.firstName,
          lastName: organizer.lastName,
          email: organizer.email,
          phoneNumber: organizer.phoneNumber,
          role: organizer.role,
          isActive: organizer.isActive,
          isPhoneVerified: organizer.isPhoneVerified,
          otpEnabled: organizer.otpEnabled,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Verify organizer OTP error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to verify code",
    });
  }
};

// Completes registration: the account already exists (register() created it
// with isPhoneVerified:false), this checks the register-purpose code that
// sent and, on success, is the first point a token is ever issued for it —
// so an account whose owner never proves the number isn't reachable can
// never actually sign in.
const verifyRegisterOtp = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (isQueryOperatorInjection(email) || isQueryOperatorInjection(code) || !email || !code) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.registerOtpCodeHash || !user.registerOtpExpires) {
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (user.registerOtpExpires < Date.now()) {
      user.registerOtpCodeHash = undefined;
      user.registerOtpExpires = undefined;
      user.registerOtpAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    if (user.registerOtpAttempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        status: "error",
        message: "Too many incorrect attempts. Request a new code.",
      });
    }

    const submittedHash = crypto.createHash("sha256").update(String(code)).digest("hex");
    if (submittedHash !== user.registerOtpCodeHash) {
      user.registerOtpAttempts += 1;
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ status: "error", message: "Invalid or expired code" });
    }

    user.registerOtpCodeHash = undefined;
    user.registerOtpExpires = undefined;
    user.registerOtpAttempts = 0;
    user.isPhoneVerified = true;
    await user.save({ validateBeforeSave: false });

    const token = signToken(user._id, user.role);
    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          isPhoneVerified: user.isPhoneVerified,
          otpEnabled: user.otpEnabled,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Verify register OTP error:", error);
    res.status(500).json({ status: "error", message: "Failed to verify code" });
  }
};

// Re-sends the registration code — the phone-pad equivalent of "resend" on
// the forgot-password/organizer-OTP screens. Scoped to accounts that are
// still unverified so this can't be used to spam a code at an account whose
// owner already proved the number and moved on.
const resendRegisterOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (isQueryOperatorInjection(email) || !email) {
      return res.status(400).json({ status: "error", message: "Email is required" });
    }

    const user = await User.findOne({ email, isPhoneVerified: false });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No pending verification found for that account.",
      });
    }

    const maskedDestination = await generateAndSendOtp(user, "sms", "register");
    res.status(200).json({
      status: "success",
      channel: "sms",
      maskedDestination,
      message: `We sent a new verification code to ${maskedDestination}.`,
    });
  } catch (error) {
    console.error("Resend register OTP error:", error);
    res.status(500).json({ status: "error", message: "Failed to resend verification code" });
  }
};

// Self-serve login-code toggle (see User.js's otpEnabled comment). Gated on
// isPhoneVerified so the account can only ever ask for a code somewhere it's
// actually confirmed to be reachable.
const updateOtpPreference = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ status: "error", message: "User not authenticated" });
    }

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ status: "error", message: "enabled must be a boolean" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ status: "error", message: "User not found" });
    }

    if (enabled && !user.isPhoneVerified) {
      return res.status(400).json({
        status: "error",
        message: "Verify your phone number before turning on login codes.",
      });
    }

    user.otpEnabled = enabled;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ status: "success", data: { otpEnabled: user.otpEnabled } });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
};

// Looks a user up by email or phone for the forgot-password flow below.
// Phone matching goes through fraudGuard's normalizePhone/phoneVariants
// (already relied on elsewhere for exactly this "match any stored format"
// problem — see isPhoneBanned) rather than a dedicated normalized-phone
// field, so this works against every existing account with no backfill
// required. Query-operator injection on `identifier` must be rejected by
// the caller before this runs — this function trusts its input.
const findUserByIdentifier = async (identifier, roleFilter, selectFields) => {
  const value = String(identifier || "").trim();
  if (!value) return null;

  const query = roleFilter ? { role: roleFilter } : {};
  if (value.includes("@")) {
    query.email = value.toLowerCase();
  } else {
    const normalized = normalizePhone(value);
    if (!normalized) return null;
    query.phoneNumber = { $in: phoneVariants(normalized) };
  }
  const lookup = User.findOne(query);
  return selectFields ? lookup.select(selectFields) : lookup;
};

// Forgot password (added 2026-09-03) — same code+channel OTP mechanism as
// the organizer sign-in OTP above, spent on a password change instead of a
// login. Shared by forgotPassword (any role on the User model) and
// organizerForgotPassword (role: "organizer" only); roleFilter is the only
// difference between the two. Like sendOrganizerOtp, "account not found"
// isn't fully hidden here — see that function's comment for why the
// masked-destination UX makes that trade-off worthwhile.
const sendPasswordResetCode = async (req, res, roleFilter) => {
  const { identifier, channel } = req.body;
  const deliveryChannel = channel === "email" ? "email" : "sms";

  if (isQueryOperatorInjection(identifier) || !identifier) {
    return res.status(400).json({ status: "error", message: "Email or phone number is required" });
  }

  const user = await findUserByIdentifier(identifier, roleFilter);
  if (!user || !user.isActive) {
    return res.status(404).json({
      status: "error",
      message:
        roleFilter === "organizer"
          ? "No organizer account found with that email or phone number."
          : "No account found with that email or phone number.",
    });
  }

  const maskedDestination = await generateAndSendOtp(user, deliveryChannel, "reset");

  return res.status(200).json({
    status: "success",
    channel: deliveryChannel,
    maskedDestination,
    message: `We sent a password reset code to ${maskedDestination}.`,
  });
};

const forgotPassword = async (req, res) => {
  try {
    await sendPasswordResetCode(req, res, null);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ status: "error", message: "Failed to send reset code" });
  }
};

const organizerForgotPassword = async (req, res) => {
  try {
    await sendPasswordResetCode(req, res, "organizer");
  } catch (error) {
    console.error("Organizer forgot password error:", error);
    res.status(500).json({ status: "error", message: "Failed to send reset code" });
  }
};

// Checks a submitted reset code against the account found by identifier —
// shared by verifyResetCode (the standalone "is this code right?" checkpoint
// the frontend calls before showing the change-password screen) and
// resetPasswordWithCode (the final submit). Mirrors verifyOrganizerOtp's
// expiry/attempt-capping checks. On success the code is deliberately left
// in place (not cleared) — see verifyResetCode below for why — so the
// caller decides what happens next; only resetPasswordWithCode ever clears
// it. Writes the error response itself and returns { ok: false } on any
// failure, so callers just do `if (!result.ok) return;`.
const checkResetCode = async (req, res, roleFilter) => {
  const { identifier, code } = req.body;

  if (
    isQueryOperatorInjection(identifier) ||
    isQueryOperatorInjection(code) ||
    !identifier ||
    !code
  ) {
    res.status(400).json({ status: "error", message: "Invalid or expired code" });
    return { ok: false };
  }

  const user = await findUserByIdentifier(identifier, roleFilter);
  if (!user || !user.resetOtpCodeHash || !user.resetOtpExpires) {
    res.status(400).json({ status: "error", message: "Invalid or expired code" });
    return { ok: false };
  }

  // Re-check isActive/isBanned before spending an attempt: the account could
  // have been banned after the code was sent. Same messaging as login.
  if (!user.isActive) {
    if (user.isBanned) {
      res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        code: "ACCOUNT_BANNED",
        message: user.banReason || "Your account has been suspended.",
      });
    } else {
      res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        message: "Your account is not active. Please contact your administrator.",
      });
    }
    return { ok: false };
  }

  if (user.resetOtpExpires < Date.now()) {
    user.resetOtpCodeHash = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    await user.save({ validateBeforeSave: false });
    res.status(400).json({ status: "error", message: "Invalid or expired code" });
    return { ok: false };
  }

  if (user.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
    res.status(429).json({
      status: "error",
      message: "Too many incorrect attempts. Request a new code.",
    });
    return { ok: false };
  }

  const submittedHash = crypto.createHash("sha256").update(String(code)).digest("hex");
  if (submittedHash !== user.resetOtpCodeHash) {
    user.resetOtpAttempts += 1;
    await user.save({ validateBeforeSave: false });
    res.status(400).json({ status: "error", message: "Invalid or expired code" });
    return { ok: false };
  }

  return { ok: true, user };
};

// Standalone verify step (added 2026-09-05): the frontend calls this right
// after the user types the code, so it only advances to the change-password
// screen once the code is actually confirmed correct — "once they got it
// right" — instead of finding out at the final submit. Deliberately does
// NOT clear resetOtpCodeHash on success: the code stays valid so the change-
// password screen's later call to resetPasswordWithCode can check it again
// without asking the user to retype it. It does reset the attempt counter,
// so a mistyped code corrected here doesn't carry a stale count forward.
const verifyResetCode = async (req, res, roleFilter) => {
  const result = await checkResetCode(req, res, roleFilter);
  if (!result.ok) return;

  result.user.resetOtpAttempts = 0;
  await result.user.save({ validateBeforeSave: false });
  res.status(200).json({ status: "success", message: "Code verified" });
};

// Sets the new password once verifyResetCode has already confirmed the code
// server-side. Mirrors verifyOrganizerOtp/resetPassword's "single use" rule:
// the code is cleared here, together with setting the password, so it can
// never be replayed after this point (from either this endpoint or a second
// call to verifyResetCode). Same "sign in immediately" behavior as the old
// email-link reset used to have.
const resetPasswordWithCode = async (req, res, roleFilter) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      status: "error",
      message: "Password must be at least 6 characters long",
    });
  }

  const result = await checkResetCode(req, res, roleFilter);
  if (!result.ok) return;
  const user = result.user;

  user.resetOtpCodeHash = undefined;
  user.resetOtpExpires = undefined;
  user.resetOtpAttempts = 0;
  user.password = newPassword;
  await user.save();

  const token = signToken(user._id, user.role);
  return res.status(200).json({
    status: "success",
    message: "Password reset successfully",
    data: {
      user: {
        _id: user._id,
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
      token,
    },
  });
};

const resetPassword = async (req, res) => {
  try {
    await resetPasswordWithCode(req, res, null);
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

const organizerResetPassword = async (req, res) => {
  try {
    await resetPasswordWithCode(req, res, "organizer");
  } catch (error) {
    console.error("Organizer reset password error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

const verifyPasswordResetCode = async (req, res) => {
  try {
    await verifyResetCode(req, res, null);
  } catch (error) {
    console.error("Verify reset code error:", error);
    res.status(500).json({ status: "error", message: "Failed to verify code" });
  }
};

const organizerVerifyResetCode = async (req, res) => {
  try {
    await verifyResetCode(req, res, "organizer");
  } catch (error) {
    console.error("Organizer verify reset code error:", error);
    res.status(500).json({ status: "error", message: "Failed to verify code" });
  }
};

// Unified auth for ticket purchase
const unifiedAuth = async (req, res) => {
  try {
    const { fullName, email, phoneNumber } = req.body;

    // phoneNumber/email feed straight into User.find()/findOne() filters
    // below. Mongoose does not reject a query-operator object (e.g.
    // `{"$ne": null}`, `{"$regex": "^09"}`) on a String path, so without this
    // check a crafted JSON body turns "find this phone number" into "find any
    // phone number" — a full, passwordless login-as-arbitrary-user. Confirmed
    // exploited against a real account on 2026-09-03; see rejectQueryOperators.js.
    if (
      isQueryOperatorInjection(phoneNumber) ||
      isQueryOperatorInjection(email) ||
      isQueryOperatorInjection(fullName)
    ) {
      return res.status(400).json({
        status: "error",
        message: "Invalid request",
      });
    }

    // Validate required fields
    if (!fullName || !phoneNumber) {
      return res.status(400).json({
        status: "error",
        message: "Full name and phone number are required",
      });
    }

    // Use phone number as password
    const password = phoneNumber;

    // Split fullName into firstName and lastName
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);

    // Allow single name for customers (lastName is optional)
    if (nameParts.length < 1) {
      return res.status(400).json({
        status: "error",
        message: "Please enter your name",
      });
    }

    const firstName = stripAngleBrackets(nameParts[0]);
    const lastName = stripAngleBrackets(nameParts.slice(1).join(" ")) || ""; // Optional last name

    // 1. Find ALL users with this phone number
    const usersByPhone = await User.find({ phoneNumber });

    // 2. Check if a customer account exists among them
    const customerUser = usersByPhone.find((u) => u.role === "customer");

    if (customerUser) {
      // Login existing customer
      const token = signToken(customerUser._id, customerUser.role);
      return res.status(200).json({
        status: "success",
        message: "Login successful",
        data: {
          user: {
            _id: customerUser._id,
            id: customerUser._id,
            firstName: customerUser.firstName,
            lastName: customerUser.lastName,
            email: customerUser.email,
            phoneNumber: customerUser.phoneNumber,
            role: customerUser.role,
            isActive: customerUser.isActive,
          },
          token,
        },
      });
    }

    // 3. If no customer account found (either no accounts at all, or only admin/organizer accounts)
    // Create NEW Customer Account
    try {
      //check if the email is already in use
      const emailalreadyInuse = await User.findOne({ email });

      const newUser = await User.create({
        firstName,
        lastName,
        email: emailalreadyInuse
          ? "customerpazimo" +
            String(Math.floor(Math.random() * 1000000)).padStart(6, "0") +
            "@gmail.com"
          : email, // Ensure unique email if not provided
        phoneNumber,
        password,
        role: "customer",
        isActive: true,
        isPhoneVerified: false,
      });

      const token = signToken(newUser._id, newUser.role);
      return res.status(201).json({
        status: "success",
        message: "Account created successfully",
        data: {
          user: {
            _id: newUser._id,
            id: newUser._id,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            email: newUser.email,
            phoneNumber: newUser.phoneNumber,
            role: newUser.role,
            isActive: newUser.isActive,
          },
          token,
        },
      });
    } catch (err) {
      //if the duplicated email is customerpazimo@gmail.com pass the catch error
      // users who didn't procide their email will have the customerpazimo@gmail.com
      if (err.code === 11000 && err.keyPattern.email) {
        return res.status(400).json({
          status: "error",
          message:
            "This email is already registered. If you have an organizer account, please use a different email for ticket purchases.",
        });
      }
      // Handle duplicate phone error (if index wasn't dropped yet)
      if (err.code === 11000 && err.keyPattern.phoneNumber) {
        return res.status(400).json({
          status: "error",
          message:
            "This phone number is already in use and cannot be duplicated at this time. Please contact support.",
        });
      }
      throw err;
    }
  } catch (error) {
    console.error("Unified auth error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: "error",
        message: `${field} is already registered`,
      });
    }

    res.status(500).json({
      status: "error",
      message: error.message || "Authentication failed",
    });
  }
};

// Delete account
const deleteAccount = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const userId = req.user._id;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({
        status: "error",
        message: "Your current password is required to delete your account",
      });
    }

    // `protect` strips `password` (select: false) — re-fetch it to confirm
    // the caller actually is who they say before doing anything irreversible.
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: "error",
        message: "Current password is incorrect",
      });
    }

    // don't Delete user's tickets we need them on the db
    // const Ticket = require("../models/Ticket");
    // await Ticket.deleteMany({ user: userId });

    // Delete user's wishlist items
    const Wishlist = require("../models/Wishlist");
    await Wishlist.deleteMany({ userId });

    // Drop any Contact/Block edges naming this account on either side, so
    // deleting an account never leaves a dangling reference in someone
    // else's contacts or blocked list.
    const Contact = require("../models/Contact");
    const Block = require("../models/Block");
    await Promise.all([
      Contact.deleteMany({ $or: [{ owner: userId }, { contact: userId }] }),
      Block.deleteMany({ $or: [{ blocker: userId }, { blocked: userId }] }),
    ]);

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      status: "success",
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to delete account",
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updatePassword,
  updateProfile,
  updateUsername,
  updatePhoneNumber,
  verifyPhoneNumber,
  adminLogin,
  forgotPassword,
  resetPassword,
  verifyPasswordResetCode,
  organizerForgotPassword,
  organizerResetPassword,
  organizerVerifyResetCode,
  sendOtp,
  sendOrganizerOtp,
  verifyOrganizerOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
  sendPhoneVerifyOtp,
  updateOtpPreference,
  unifiedAuth,
  deleteAccount,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  unregisterPushToken,
};
