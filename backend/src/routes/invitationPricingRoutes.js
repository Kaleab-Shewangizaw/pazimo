const express = require('express');
const router = express.Router();
const InvitationPricing = require('../models/InvitationPricing');

// Get all pricing
router.get('/', async (req, res) => {
  try {
    const pricing = await InvitationPricing.find();
    
    // Format response
    const formattedPricing = {
      public: pricing.find(p => p.eventType === 'public') || { emailPrice: 10, smsPrice: 10 },
      private: pricing.find(p => p.eventType === 'private') || { emailPrice: 10, smsPrice: 10 }
    };
    
    res.json({
      success: true,
      data: formattedPricing
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pricing by event type
router.get('/:eventType', async (req, res) => {
  try {
    const { eventType } = req.params;
    
    if (!['public', 'private'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    
    const pricing = await InvitationPricing.findOne({ eventType });
    
    if (!pricing) {
      // Return default pricing if not found
      return res.json({
        success: true,
        data: { emailPrice: 10, smsPrice: 10 }
      });
    }
    
    res.json({
      success: true,
      data: {
        emailPrice: pricing.emailPrice,
        smsPrice: pricing.smsPrice
      }
    });
  } catch (error) {
    console.error('Get pricing by type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update pricing (admin only)
router.put('/', async (req, res) => {
  try {
    const { public: publicPricing, private: privatePricing } = req.body;

    // Update or create public pricing
    await InvitationPricing.findOneAndUpdate(
      { eventType: 'public' },
      { 
        emailPrice: parseFloat(publicPricing.emailPrice),
        smsPrice: parseFloat(publicPricing.smsPrice)
      },
      { upsert: true, new: true }
    );

    // Update or create private pricing
    await InvitationPricing.findOneAndUpdate(
      { eventType: 'private' },
      { 
        emailPrice: parseFloat(privatePricing.emailPrice),
        smsPrice: parseFloat(privatePricing.smsPrice)
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Pricing updated successfully'
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;