const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo, protectStrictOrTrustParamId } = require('../middlewares/auth');

// Optimized route for fetching organizers with stats (must be before /:id)
router.get('/organizers-stats', protect, restrictTo('admin'), userController.getOrganizersWithStats);

// Account creation stays open (public signup path); role is never accepted from the body.
router.post('/', userController.createUser);

// Listing all users and fraud incidents is mass/sensitive data - admin only.
router.get('/', protect, restrictTo('admin'), userController.getAllUsers);
router.get('/:id/fraud-incidents', protect, restrictTo('admin'), userController.getUserFraudIncidents);
// TEMP-BYPASS-2026-07-10: mobile app has a bug where it sends no auth token
// on this call at all, so it can't get past `protect`. Until the app is
// fixed (this weekend), protectStrictOrTrustParamId lets an unauthenticated
// request through IF the requested :id belongs to an admin/organizer account
// - a real, intentional security downgrade on this one route. See the big
// comment block around protectStrictOrTrustParamId in middlewares/auth.js
// for the exact revert steps.
// TO REVERT: router.get('/:id', protect, restrictTo('admin', 'organizer'), userController.getUser);
router.get('/:id', protectStrictOrTrustParamId, userController.getUser);
router.put('/:id', protect, restrictTo('admin'), userController.updateUser);
router.delete('/:id', protect, restrictTo('admin'), userController.deleteUser);

module.exports = router;


