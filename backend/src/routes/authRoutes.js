


const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, authenticateUser } = require('../middlewares/auth');

// Registration route
router.post('/register', authController.register);

// Login route
router.post('/login', authController.login);

// Get current user
router.get('/me', protect, authController.getMe);

// Password reset routes
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.put('/update-profile', protect, authController.updateProfile);


// OTP routes
router.post('/send-otp', authController.sendOtp);

// Unified auth route for ticket purchase
router.post('/unified-auth', authController.unifiedAuth);

// Delete account route
router.delete('/delete-account', protect, authController.deleteAccount);

// Admin routes
router.post('/admin/login', authController.adminLogin);
router.get('/admin/me', protect, authenticateUser, authController.getMe);

module.exports = router;
