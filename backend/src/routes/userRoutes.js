const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middlewares/auth');

// Optimized route for fetching organizers with stats (must be before /:id)
router.get('/organizers-stats', protect, restrictTo('admin'), userController.getOrganizersWithStats);

// Account creation stays open (public signup path); role is never accepted from the body.
router.post('/', userController.createUser);

// Listing all users and fraud incidents is mass/sensitive data - admin only.
router.get('/', protect, restrictTo('admin'), userController.getAllUsers);
router.get('/:id/fraud-incidents', protect, restrictTo('admin'), userController.getUserFraudIncidents);
// Reverted 2026-08-20 to the pre-bypass rule. Between 2026-07-10 and this
// change, TEMP-BYPASS-2026-07-10 let a request with no token at all read this
// account's email, phone and ban status whenever the :id belonged to an admin
// or organizer. `protect` still accepts the token from the non-standard places
// the mobile app might put it (see extractToken), so only a genuinely
// credential-less request is now refused.
router.get('/:id', protect, restrictTo('admin', 'organizer'), userController.getUser);
router.put('/:id', protect, restrictTo('admin'), userController.updateUser);
router.delete('/:id', protect, restrictTo('admin'), userController.deleteUser);

module.exports = router;


