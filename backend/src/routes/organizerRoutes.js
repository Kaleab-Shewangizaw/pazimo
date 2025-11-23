const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const organizerController = require('../controllers/organizerController');
const { protect, restrictTo } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Debug middleware
router.use((req, res, next) => {
  console.log('Organizer Route accessed:', req.method, req.path);
  next();
});

// Public routes
router.post('/sign-up', upload.single('businessLicense'), organizerController.signUp);

// Protected routes
router.get('/profile', authenticateUser, organizerController.getProfile);
router.put('/profile', authenticateUser, organizerController.updateProfile);
router.put('/security', authenticateUser, organizerController.updatePassword);

// Admin routes
router.get('/registrations', protect, restrictTo('admin'), organizerController.getRegistrations);
router.patch('/registrations/:id/status', protect, restrictTo('admin'), organizerController.updateRegistrationStatus);

// Debug route to test if router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Organizer routes are working' });
});

module.exports = router; 