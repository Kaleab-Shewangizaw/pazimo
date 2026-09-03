const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");
const { UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
const { isPhoneBanned } = require("../utils/fraudGuard");
const { isQueryOperatorInjection } = require("../utils/rejectQueryOperators");
const { stripAngleBrackets } = require("../utils/stripHtml");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const signToken = (id, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Configure nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Forgot Password
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(StatusCodes.NOT_FOUND).json({
//         status: 'error',
//         message: 'No user found with that email address'
//       });
//     }

//     // Generate reset token
//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     const passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

//     user.passwordResetToken = passwordResetToken;
//     user.passwordResetExpires = passwordResetExpires;
//     await user.save({ validateBeforeSave: false });

//     // Send email
//     const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

//     const transporter = createTransporter();
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: user.email,
//       subject: 'Password Reset Request',
//       html: `
//         <h2>Password Reset Request</h2>
//         <p>You requested a password reset. Click the link below to reset your password:</p>
//         <a href="${resetURL}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
//         <p>This link will expire in 10 minutes.</p>
//         <p>If you didn't request this, please ignore this email.</p>
//       `
//     };

//     await transporter.sendMail(mailOptions);

//     res.status(StatusCodes.OK).json({
//       status: 'success',
//       message: 'Password reset email sent successfully'
//     });
//   } catch (error) {
//     res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// Forgot Password - NO EMAIL VERSION
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     console.log('Forgot password request for:', email);

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'No user found with that email address'
//       });
//     }

//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     const passwordResetExpires = Date.now() + 10 * 60 * 1000;

//     user.passwordResetToken = passwordResetToken;
//     user.passwordResetExpires = passwordResetExpires;
//     await user.save({ validateBeforeSave: false });

//     const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

//     // Just log the URL - NO EMAIL SENDING
//     console.log('=================================');
//     console.log('PASSWORD RESET URL:', resetURL);
//     console.log('=================================');

//     res.status(200).json({
//       status: 'success',
//       message: 'Password reset link generated (check console)',
//       resetURL: resetURL // For testing only
//     });
//   } catch (error) {
//     console.error('Forgot password error:', error);
//     res.status(500).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// Forgot Password - WITH EMAIL SENDING
// const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     console.log('Forgot password request for:', email);

//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({
//         status: 'error',
//         message: 'No user found with that email address'
//       });
//     }

//     const resetToken = crypto.randomBytes(32).toString('hex');
//     const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
//     const passwordResetExpires = Date.now() + 10 * 60 * 1000;

//     user.passwordResetToken = passwordResetToken;
//     user.passwordResetExpires = passwordResetExpires;
//     await user.save({ validateBeforeSave: false });

//     const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

//     // Send email using Ethereal
//     const testAccount = await nodemailer.createTestAccount();
//     const transporter = nodemailer.createTransport({
//       host: 'smtp.ethereal.email',
//       port: 587,
//       secure: false,
//       auth: {
//         user: testAccount.user,
//         pass: testAccount.pass,
//       },
//     });

//     const mailOptions = {
//       from: 'noreply@yourapp.com',
//       to: user.email,
//       subject: 'Password Reset Request',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2 style="color: #333;">Password Reset Request</h2>
//           <p>Hello ${user.firstName},</p>
//           <p>You requested a password reset. Click the button below to reset your password:</p>
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${resetURL}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
//           </div>
//           <p>Or copy and paste this link in your browser:</p>
//           <p style="word-break: break-all; color: #007bff;">${resetURL}</p>
//           <p><strong>This link will expire in 10 minutes.</strong></p>
//           <p>If you didn't request this, please ignore this email.</p>
//         </div>
//       `
//     };

//     const info = await transporter.sendMail(mailOptions);

//     // Log preview URL for testing
//     console.log('=================================');
//     console.log('EMAIL PREVIEW URL:', nodemailer.getTestMessageUrl(info));
//     console.log('=================================');

//     res.status(200).json({
//       status: 'success',
//       message: 'Password reset email sent successfully',
//       previewURL: nodemailer.getTestMessageUrl(info) // For testing only
//     });
//   } catch (error) {
//     console.error('Forgot password error:', error);
//     res.status(500).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };
// Forgot Password - WITH REAL GMAIL
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // See rejectQueryOperators.js — reject a query-operator object before it
    // reaches findOne(), same as login/unifiedAuth.
    if (isQueryOperatorInjection(email)) {
      return res.status(200).json({
        status: "success",
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const user = await User.findOne({ email });
    // Always return 200 — never reveal whether the email exists
    if (!user) {
      return res.status(200).json({
        status: "success",
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const passwordResetExpires = Date.now() + 10 * 60 * 1000;

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save({ validateBeforeSave: false });

    const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Use Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset Request - PAZ",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested a password reset for your PAZ account. Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetURL}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #007bff; background: #f5f5f5; padding: 10px; border-radius: 5px;">${resetURL}</p>
          <p><strong>This link will expire in 10 minutes.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">This email was sent from PAZ Event Management System.</p>
        </div>
      `,
    };

    // Send response immediately
    res.status(200).json({
      status: "success",
      message: "Password reset email sent successfully",
    });

    // Send email in background
    setImmediate(async () => {
      try {
        await transporter.sendMail(mailOptions);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Token is invalid or has expired",
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const authToken = signToken(user._id, user.role);

    res.status(StatusCodes.OK).json({
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
        token: authToken,
      },
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: error.message,
    });
  }
};

// Register user
const register = async (req, res) => {
  try {
    // Whitelist allowed fields — never trust role from the client
    const { email, password, firstName, lastName, phoneNumber } = req.body;

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

    const user = await User.create({
      email,
      password,
      firstName: stripAngleBrackets(firstName),
      lastName: stripAngleBrackets(lastName),
      phoneNumber,
      role: 'customer',
    });
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
        },
        token,
      },
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({
      status: "error",
      message: error.message,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // See rejectQueryOperators.js: email/password must be plain strings
    // before either reaches a query or bcrypt, or a query-operator object
    // (e.g. `{"$ne": null}`) turns the lookup into "match any account".
    if (isQueryOperatorInjection(email) || isQueryOperatorInjection(password)) {
      throw new UnauthorizedError("Invalid credentials");
    }

    // Find user
    const user = await User.findOne({ email }).select("+password");
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
    if (user.role === "organizer") {
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

    // Check if email is already taken by another user
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

// Add new method to verify phone number
const verifyPhoneNumber = async (req, res) => {
  try {
    const { verificationCode } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

    const userId = req.user.id;

    // Here you would typically verify the code against what was sent to the user
    // This is a placeholder for the actual verification logic
    const isValidCode = true; // Replace with actual verification logic

    if (!isValidCode) {
      return res.status(400).json({
        status: "error",
        message: "Invalid verification code",
      });
    }

    // Update user's phone verification status
    const user = await User.findByIdAndUpdate(
      userId,
      { isPhoneVerified: true },
      { new: true },
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
// endpoint for the existing sendOtp() above, and there's no way to confirm
// that flow actually works end to end without spending real SMS credits
// against an undocumented contract.
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
const maskPhoneForDisplay = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  const local = digits.startsWith("251")
    ? "0" + digits.slice(3)
    : digits.startsWith("0")
      ? digits
      : `0${digits}`;
  if (local.length <= 3) return "*".repeat(local.length);
  return local.slice(0, 2) + "*".repeat(local.length - 2);
};

const maskEmailForDisplay = (email) => {
  if (!email || typeof email !== "string" || !email.includes("@")) return null;
  const [name, domain] = email.split("@");
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
};

// Shared by sendOrganizerOtp (the standalone "sign in with a code" path) and
// login (the password path's mandatory second factor for organizers, added
// 2026-09-04). Generates the code, hashes+stores it on the exact user
// document passed in — never re-looked-up from client input at send time —
// so the destination is always the one actually on that account, never
// something a caller could redirect by supplying a different email/phone in
// the request body.
const generateAndSendOtp = async (user, channel) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.otpCodeHash = crypto.createHash("sha256").update(code).digest("hex");
  user.otpExpires = Date.now() + OTP_TTL_MS;
  user.otpAttempts = 0;
  await user.save({ validateBeforeSave: false });

  const maskedDestination =
    channel === "email"
      ? maskEmailForDisplay(user.email)
      : maskPhoneForDisplay(user.phoneNumber);

  // Fire-and-forget, same pattern as forgotPassword's email send — the
  // caller's response doesn't wait on the SMS/SMTP round trip.
  if (channel === "email") {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    transporter
      .sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "Your Pazimo verification code",
        html: `<p>Your Pazimo verification code is <strong>${code}</strong>. It expires in 10 minutes. Never share this code with anyone.</p>`,
      })
      .catch((err) => console.error("Failed to send OTP email:", err));
  } else {
    const { sendSMS } = require("../utils/sms");
    sendSMS(
      user.phoneNumber,
      `Your Pazimo verification code is ${code}. It expires in 10 minutes. Never share this code.`
    ).catch((err) => console.error("Failed to send OTP SMS:", err));
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

    const organizer = await User.findOne({ email, role: "organizer" });
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

    // Find and delete the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // don't Delete user's tickets we need them on the db
    // const Ticket = require("../models/Ticket");
    // await Ticket.deleteMany({ user: userId });

    // Delete user's wishlist items
    const Wishlist = require("../models/Wishlist");
    await Wishlist.deleteMany({ userId });

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
  updatePhoneNumber,
  verifyPhoneNumber,
  adminLogin,
  forgotPassword,
  resetPassword,
  sendOtp,
  sendOrganizerOtp,
  verifyOrganizerOtp,
  unifiedAuth,
  deleteAccount,
};
