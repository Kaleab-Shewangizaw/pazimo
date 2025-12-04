// const jwt = require('jsonwebtoken');
// const User = require('../models/User');
// const { UnauthorizedError } = require('../errors');
// const { StatusCodes } = require('http-status-codes');

// const signToken = (id, role) => {
//   if (!process.env.JWT_SECRET) {
//     throw new Error('JWT_SECRET is not defined in environment variables');
//   }
//   return jwt.sign(
//     { id, role },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
//   );
// };

// // Register user
// const register = async (req, res) => {
//   try {
//     const user = await User.create(req.body);
//     const token = signToken(user._id, user.role);

//     res.status(StatusCodes.CREATED).json({
//       status: 'success',
//       data: {
//         user: {
//           _id: user._id,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           email: user.email,
//           role: user.role,
//         },
//         token,
//       },
//     });
//   } catch (error) {
//     res.status(StatusCodes.BAD_REQUEST).json({
//       status: 'error',
//       message: error.message,
//     });
//   }
// };

// // Login user
// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Find user
//     const user = await User.findOne({ email }).select('+password');
//     if (!user) {
//       throw new UnauthorizedError('Invalid credentials');
//     }

//     // Check password
//     const isPasswordCorrect = await user.comparePassword(password);
//     if (!isPasswordCorrect) {
//       throw new UnauthorizedError('Invalid credentials');
//     }

//     // Check if user is active
//     if (!user.isActive) {
//       return res.status(StatusCodes.FORBIDDEN).json({
//         status: 'error',
//         message: 'Your account is not active. Please contact your administrator.'
//       });
//     }

//     // Generate token
//     const token = signToken(user._id, user.role);

//     res.status(StatusCodes.OK).json({
//       status: 'success',
//       data: {
//         user: {
//           _id: user._id,
//           firstName: user.firstName,
//           lastName: user.lastName,
//           email: user.email,
//           role: user.role,
//           isActive: user.isActive
//         },
//         token,
//       },
//     });
//   } catch (error) {
//     res.status(StatusCodes.UNAUTHORIZED).json({
//       status: 'error',
//       message: error.message,
//     });
//   }
// };

// // Get current user
// const getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user._id).select('-password');
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

// // Update password
// const updatePassword = async (req, res) => {
//   try {
//     const { currentPassword, newPassword } = req.body;
//     const user = await User.findById(req.user._id);

//     // Check current password
//     const isPasswordCorrect = await user.comparePassword(currentPassword);
//     if (!isPasswordCorrect) {
//       throw new UnauthorizedError('Current password is incorrect');
//     }

//     // Update password
//     user.password = newPassword;
//     await user.save();

//     res.status(StatusCodes.OK).json({
//       status: 'success',
//       message: 'Password updated successfully',
//     });
//   } catch (error) {
//     res.status(StatusCodes.BAD_REQUEST).json({
//       status: 'error',
//       message: error.message,
//     });
//   }
// };

// // Update profile
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

// // Add new method to update phone number
// const updatePhoneNumber = async (req, res) => {
//   try {
//     const { phoneNumber } = req.body;
//     const userId = req.user.id;

//     // Check if phone number is already registered
//     const existingUser = await User.findOne({ phoneNumber });
//     if (existingUser && existingUser._id.toString() !== userId) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Phone number already registered'
//       });
//     }

//     // Update user's phone number
//     const user = await User.findByIdAndUpdate(
//       userId,
//       {
//         phoneNumber,
//         isPhoneVerified: false // Reset verification status when phone number changes
//       },
//       { new: true, runValidators: true }
//     );

//     user.password = undefined;

//     res.status(200).json({
//       status: 'success',
//       data: { user }
//     });
//   } catch (error) {
//     res.status(400).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// // Add new method to verify phone number
// const verifyPhoneNumber = async (req, res) => {
//   try {
//     const { verificationCode } = req.body;
//     const userId = req.user.id;

//     // Here you would typically verify the code against what was sent to the user
//     // This is a placeholder for the actual verification logic
//     const isValidCode = true; // Replace with actual verification logic

//     if (!isValidCode) {
//       return res.status(400).json({
//         status: 'error',
//         message: 'Invalid verification code'
//       });
//     }

//     // Update user's phone verification status
//     const user = await User.findByIdAndUpdate(
//       userId,
//       { isPhoneVerified: true },
//       { new: true }
//     );

//     user.password = undefined;

//     res.status(200).json({
//       status: 'success',
//       data: { user }
//     });
//   } catch (error) {
//     res.status(400).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// const adminLogin = async (req, res) => {
//   try {
//     console.log('Admin login attempt:', req.body); // Debug log

//     const { email, password } = req.body;

//     // Check if email and password exist
//     if (!email || !password) {
//       console.log('Missing email or password'); // Debug log
//       return res.status(400).json({
//         status: 'error',
//         message: 'Please provide email and password'
//       });
//     }

//     // Check if user exists && password is correct
//     const user = await User.findOne({ email }).select('+password');
//     console.log('Found user:', user ? 'Yes' : 'No'); // Debug log

//     if (!user) {
//       return res.status(401).json({
//         status: 'error',
//         message: 'Incorrect email or password'
//       });
//     }

//     const isPasswordCorrect = await user.comparePassword(password);
//     console.log('Password correct:', isPasswordCorrect); // Debug log

//     if (!isPasswordCorrect) {
//       return res.status(401).json({
//         status: 'error',
//         message: 'Incorrect email or password'
//       });
//     }

//     // Check if user is admin
//     if (user.role !== 'admin') {
//       console.log('User role:', user.role); // Debug log
//       return res.status(403).json({
//         status: 'error',
//         message: 'Access denied. Admin privileges required.'
//       });
//     }

//     // Update last login
//     user.lastLogin = Date.now();
//     await user.save({ validateBeforeSave: false });

//     // Generate token
//     const token = signToken(user._id, user.role);

//     // Remove password from output
//     user.password = undefined;

//     console.log('Login successful for admin:', user.email); // Debug log

//     res.status(200).json({
//       status: 'success',
//       token,
//       data: { user }
//     });
//   } catch (error) {
//     console.error('Admin login error:', error);
//     res.status(400).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// // Add admin middleware
// const isAdmin = async (req, res, next) => {
//   try {
//     if (req.user.role !== 'admin') {
//       return res.status(403).json({
//         status: 'error',
//         message: 'Access denied. Admin privileges required.'
//       });
//     }
//     next();
//   } catch (error) {
//     res.status(400).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

// module.exports = {
//   register,
//   login,
//   getMe,
//   updatePassword,
//   updateProfile,
//   updatePhoneNumber,
//   verifyPhoneNumber,
//   isAdmin,
//   adminLogin,
// };

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { UnauthorizedError } = require("../errors");
const { StatusCodes } = require("http-status-codes");
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

    console.log("Forgot password request for:", email);

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "No user found with that email address",
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
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
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
    const user = await User.create(req.body);
    const token = signToken(user._id, user.role);

    res.status(StatusCodes.CREATED).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
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

    // Check if user is active
    if (!user.isActive) {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: "error",
        message:
          "Your account is not active. Please contact your administrator.",
      });
    }

    // Generate token
    const token = signToken(user._id, user.role);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
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
    const user = await User.findById(req.user._id).select("-password");
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
    const { firstName, lastName, email, phoneNumber } = req.body;

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
      { firstName, lastName, email, phoneNumber },
      { new: true, runValidators: true }
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
      { new: true, runValidators: true }
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
      { new: true }
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

    // Check if user exists && password is correct
    const user = await User.findOne({ email }).select("+password");
    // console.log('Found user:', user ? 'Yes' : 'No'); // Debug log

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password",
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);
    // console.log('Password correct:', isPasswordCorrect); // Debug log

    if (!isPasswordCorrect) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect email or password",
      });
    }

    // Check if user is admin or partner
    if (user.role !== "admin" && user.role !== "partner") {
      // console.log('User role:', user.role); // Debug log
      return res.status(403).json({
        status: "error",
        message: "Access denied. Admin or partner privileges required.",
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Generate token
    const token = signToken(user._id, user.role);

    // Remove password from output
    user.password = undefined;

    // console.log('Login successful for admin:', user.email); // Debug log

    res.status(200).json({
      status: "success",
      token,
      data: { user },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// Add admin middleware
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        status: "error",
        message: "User not authenticated",
      });
    }

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

// ... keep all existing functions (register, login, getMe, etc.)

// Send OTP
const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    const response = await fetch(
      `https://api.geezsms.com/api/v1/sms/otp?token=aL1wTWYrFKag3XVOP4iuQ6KNRIK283nw&shortcode_id=825&phone=${phoneNumber}`
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

// Unified auth for ticket purchase
const unifiedAuth = async (req, res) => {
  try {
    const { fullName, email, phoneNumber } = req.body;

    console.log("=== UNIFIED AUTH DEBUG ===");
    console.log("Request body:", { fullName, email, phoneNumber });

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
    if (nameParts.length < 2) {
      return res.status(400).json({
        status: "error",
        message: "Please enter your full name (first and last name)",
      });
    }
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

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
      const newUser = await User.create({
        firstName,
        lastName,
        email: email || `user_${phoneNumber}_${Date.now()}@temp.com`, // Ensure unique email if not provided
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
      // Handle duplicate email error
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

    // Delete user's tickets
    const Ticket = require("../models/Ticket");
    await Ticket.deleteMany({ user: userId });

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
  isAdmin,
  adminLogin,
  forgotPassword,
  resetPassword,
  sendOtp,
  unifiedAuth,
  deleteAccount,
};
