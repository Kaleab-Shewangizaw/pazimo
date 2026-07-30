


const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const {
  loginLimiter,
  adminLoginLimiter,
  developerLoginLimiter,
  registerLimiter,
  otpLimiter,
  unifiedAuthLimiter,
} = require('../middlewares/rateLimiters');

// Registration route
router.post('/register', registerLimiter, authController.register);

// Login route
router.post('/login', loginLimiter, authController.login);

// Get current user
router.get('/me', protect, authController.getMe);

// Password reset routes - not a functioning feature yet, left unlimited for now
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.put('/update-profile', protect, authController.updateProfile);


// OTP routes
router.post('/send-otp', otpLimiter, authController.sendOtp);

// Unified auth route for ticket purchase
router.post('/unified-auth', unifiedAuthLimiter, authController.unifiedAuth);

// Delete account route
router.delete('/delete-account', protect, authController.deleteAccount);

// Admin routes
router.post('/admin/login', adminLoginLimiter, authController.adminLogin);
router.get('/admin/me', protect, authController.getMe);

// Developer routes
router.post('/developer/login', developerLoginLimiter, authController.developerLogin);
router.get('/developer/me', protect, authController.getMe);

module.exports = router;
