const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, restrictTo, selfOrAdmin } = require('../middlewares/auth');

// Optimized route for fetching organizers with stats (must be before /:id)
router.get('/organizers-stats', protect, restrictTo('admin'), userController.getOrganizersWithStats);

// Account creation stays open (public signup path); role is never accepted from the body.
router.post('/', userController.createUser);

// Listing all users and fraud incidents is mass/sensitive data - admin only.
router.get('/', protect, restrictTo('admin'), userController.getAllUsers);
router.get('/:id/fraud-incidents', protect, restrictTo('admin'), userController.getUserFraudIncidents);
// A single user's own record can be read by that user (e.g. the organizer
// app fetching its own profile) or by an admin looking up anyone.
router.get('/:id', protect, selfOrAdmin, userController.getUser);
router.put('/:id', protect, restrictTo('admin'), userController.updateUser);
router.delete('/:id', protect, restrictTo('admin'), userController.deleteUser);

module.exports = router;


