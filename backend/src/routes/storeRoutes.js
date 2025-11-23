const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { protect, restrictTo } = require('../middlewares/auth');

// Store routes accessible by both customers and organizers
router.get('/profile', protect, restrictTo('customer', 'organizer'), storeController.getStoreProfile);
router.patch('/preferences', protect, restrictTo('customer', 'organizer'), storeController.updateStorePreferences);

// Store routes accessible only by organizers
router.get('/stats', protect, restrictTo('organizer'), storeController.getStoreStats);

module.exports = router; 