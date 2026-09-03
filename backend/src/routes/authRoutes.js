


const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const {
  loginLimiter,
  adminLoginLimiter,
  registerLimiter,
  otpLimiter,
  organizerOtpSendLimiter,
  organizerOtpVerifyLimiter,
  passwordResetSendLimiter,
  passwordResetVerifyLimiter,
  unifiedAuthLimiter,
} = require('../middlewares/rateLimiters');

// Registration route
router.post('/register', registerLimiter, authController.register);

// Login route
router.post('/login', loginLimiter, authController.login);

// Get current user
router.get('/me', protect, authController.getMe);

// Password reset — OTP-based (added 2026-09-03), same code+channel
// mechanism as the organizer sign-in OTP below. Covers every role on the
// User model (customer, organizer, venue, cinema); the single Admin account
// has no self-service reset. Three steps: send a code to the email/phone the
// user types, verify it (the frontend only advances to its change-password
// screen once this succeeds), then submit the new password.
router.post('/forgot-password', passwordResetSendLimiter, authController.forgotPassword);
router.post('/verify-reset-code', passwordResetVerifyLimiter, authController.verifyPasswordResetCode);
router.post('/reset-password', passwordResetVerifyLimiter, authController.resetPassword);
router.put('/update-profile', protect, authController.updateProfile);
router.put('/update-username', protect, authController.updateUsername);


// OTP routes
router.post('/send-otp', otpLimiter, authController.sendOtp);

// Organizer OTP login — a second login path alongside email+password,
// added 2026-09-03 (see docs/SECURITY_VULNERABILITIES.md #11-13). Sends a
// 6-digit code by SMS by default, or by email if the caller asks for that
// channel instead.
router.post('/organizer/send-otp', organizerOtpSendLimiter, authController.sendOrganizerOtp);
router.post('/organizer/verify-otp', organizerOtpVerifyLimiter, authController.verifyOrganizerOtp);

// Organizer-scoped password reset — same OTP mechanism as /forgot-password
// above, but confirms the email belongs to an organizer account first (see
// sendOrganizerOtp's comment on why "account not found" isn't fully hidden
// there — same trade-off applies here for the masked-destination UX).
router.post('/organizer/forgot-password', passwordResetSendLimiter, authController.organizerForgotPassword);
router.post('/organizer/verify-reset-code', passwordResetVerifyLimiter, authController.organizerVerifyResetCode);
router.post('/organizer/reset-password', passwordResetVerifyLimiter, authController.organizerResetPassword);

// Unified auth route for ticket purchase
router.post('/unified-auth', unifiedAuthLimiter, authController.unifiedAuth);

// Delete account route
router.delete('/delete-account', protect, authController.deleteAccount);

// Admin routes
router.post('/admin/login', adminLoginLimiter, authController.adminLogin);
router.get('/admin/me', protect, authController.getMe);

module.exports = router;
