const express = require('express');
const InvitationPricing = require('../models/InvitationPricing');
const router = express.Router();

// Get pricing for specific event type
router.get('/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    const pricing = await InvitationPricing.findOne({ eventType });
    
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found for this event type' });
    }
    
    res.json({ data: pricing });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;