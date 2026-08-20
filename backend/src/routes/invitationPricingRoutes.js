const express = require('express');
const router = express.Router();
const InvitationPricing = require('../models/InvitationPricing');
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const { adminWriteLimiter } = require('../middlewares/rateLimiters');

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

// A price is a number Pazimo charges organizers, so it is validated the way
// money is validated everywhere else: present, parseable, finite, and not
// negative. parseFloat(undefined) is NaN, which Mongoose would previously have
// rejected with a 500 or — worse, for a partial body — left one event type
// silently untouched while reporting success.
const parsePrice = (value, label) => {
  const price = parseFloat(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${label} must be a number of 0 or more`);
  }
  return price;
};

// Update pricing.
//
// ADMIN ONLY. This sets what organizers are charged per invitation email and
// SMS. Until 2026-08-20 it referenced no credential at all: an anonymous PUT
// answered 200 and could set every price on the platform to 0.
router.put('/', adminWriteLimiter, authenticateUser, restrictTo('admin'), async (req, res) => {
  try {
    const { public: publicPricing, private: privatePricing } = req.body;

    if (!publicPricing || !privatePricing) {
      return res.status(400).json({
        error: 'Both public and private pricing are required',
      });
    }

    let prices;
    try {
      prices = {
        publicEmail: parsePrice(publicPricing.emailPrice, 'Public email price'),
        publicSms: parsePrice(publicPricing.smsPrice, 'Public SMS price'),
        privateEmail: parsePrice(privatePricing.emailPrice, 'Private email price'),
        privateSms: parsePrice(privatePricing.smsPrice, 'Private SMS price'),
      };
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    // Update or create public pricing
    await InvitationPricing.findOneAndUpdate(
      { eventType: 'public' },
      {
        emailPrice: prices.publicEmail,
        smsPrice: prices.publicSms
      },
      { upsert: true, new: true }
    );

    // Update or create private pricing
    await InvitationPricing.findOneAndUpdate(
      { eventType: 'private' },
      {
        emailPrice: prices.privateEmail,
        smsPrice: prices.privateSms
      },
      { upsert: true, new: true }
    );

    console.log(
      `[INVITATION-PRICING] updated by admin ${req.user.userId}: ` +
        `public ${prices.publicEmail}/${prices.publicSms}, ` +
        `private ${prices.privateEmail}/${prices.privateSms}`
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