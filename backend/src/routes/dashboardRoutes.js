const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/auth');

// Admin Dashboard
router.get('/admin', protect, restrictTo('admin'), (req, res) => {
  res.json({
    status: 'success',
    data: {
      message: 'Welcome to Admin Dashboard',
      user: req.user,
      features: [
        'User Management',
        'System Settings',
        'Analytics',
        'Reports'
      ]
    }
  });
});

// Store Routes (shared between customers and organizers)
router.get('/store', protect, restrictTo('customer', 'organizer'), (req, res) => {
  // Different store views based on role
  const storeData = {
    customer: {
      message: 'Welcome to the Store',
      features: [
        'Browse Products',
        'View Orders',
        'Shopping Cart',
        'Profile Settings'
      ]
    },
    organizer: {
      message: 'Welcome to the Store Management',
      features: [
        'Manage Products',
        'View Orders',
        'Customer Management',
        'Store Settings'
      ]
    }
  };

  res.json({
    status: 'success',
    data: {
      ...storeData[req.user.role],
      user: req.user
    }
  });
});

module.exports = router; 