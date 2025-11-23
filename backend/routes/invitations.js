const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const auth = require('../middleware/auth');

// Create invitation
router.post('/', auth, async (req, res) => {
  try {
    const invitation = new Invitation({
      ...req.body,
      organizerId: req.user.id
    });
    await invitation.save();
    res.status(201).json({ success: true, data: invitation });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get invitations by organizer
router.get('/organizer/:organizerId', auth, async (req, res) => {
  try {
    const invitations = await Invitation.find({ 
      organizerId: req.params.organizerId 
    }).populate('eventId', 'title').sort({ createdAt: -1 });
    
    res.json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;