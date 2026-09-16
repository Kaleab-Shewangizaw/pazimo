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
// The already-published organizer app (separate codebase, can't be updated
// until pazimo-organizer-mobile replaces it) still sends no token here at
// all — protectStrictOrTrustParamId lets that through, controlled by
// ORGANIZER_LEGACY_APP_BYPASS_ENABLED (defaults on). See the
// TEMP-BYPASS-2026-07-10 block in middlewares/auth.js for the full
// reasoning; turn it off there by setting that env var to "false" once the
// old app is retired, no route change needed.
router.get('/:id', protectStrictOrTrustParamId, userController.getUser);
router.put('/:id', protect, restrictTo('admin'), userController.updateUser);
router.delete('/:id', protect, restrictTo('admin'), userController.deleteUser);

module.exports = router;
