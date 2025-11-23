const express = require('express');
const router = express.Router();
const rsvpRoutes = require('../../routes/rsvp');

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running'
  });
});

// RSVP routes
router.use('/rsvp', rsvpRoutes);

module.exports = router; 