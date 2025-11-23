const mongoose = require('mongoose');

const invitationPricingSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ['public', 'private'],
    required: true
  },
  emailPrice: {
    type: Number,
    required: true,
    min: 0
  },
  smsPrice: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  timestamps: true
});

// Ensure only one pricing record per event type
invitationPricingSchema.index({ eventType: 1 }, { unique: true });

module.exports = mongoose.model('InvitationPricing', invitationPricingSchema);