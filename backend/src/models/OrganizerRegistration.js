const mongoose = require('mongoose');

const organizerRegistrationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true
  },
  eventDetails: {
    expectedAttendees: { type: Number, required: true, min: 0 },
    // ticketTypes: {
    //   regular: { type: Boolean, default: false },
    //   vip: { type: Boolean, default: false },
    //   vvip: { type: Boolean, default: false },
    //   earlyBird: { type: Boolean, default: false },
    //   bundle: { type: Boolean, default: false }
    // },
    // ageRestriction: {
    //   type: String,
    //   enum: ['3+', '7+', '13+', '16+', '18+', '21+', '25+', 'none'],
    //   default: 'none'
    // },
    // promoCode: { type: String, trim: true },
    offerPromo: { type: Boolean, default: false },
    marketingSupport: { type: Boolean, default: false },
    frontPageAd: { type: Boolean, default: false },
    onsiteSupport: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    trim: true
  },
  organizerType: { type: String, trim: true },
  organizerTypeOther: { type: String, trim: true },
  socialLinks: { type: String, trim: true },
  businessLicenseUrl: { type: String, trim: true },
  tinNumber: { type: String, trim: true },
  businessAddress: { type: String, trim: true },
  bankAccountHolder: { type: String, trim: true },
  bankName: { type: String, trim: true },
  bankAccountNumber: { type: String, trim: true },
  contactRole: { type: String, trim: true },
  hasOrganizedBefore: { type: String, trim: true },
  eventKinds: [{ type: String, trim: true }],
  eventKindOther: { type: String, trim: true },
  sampleEventName: { type: String, trim: true },
  estimatedAudience: { type: String, trim: true },
  eventFrequency: { type: String, trim: true },
  payoutMethod: { type: String, trim: true },
  needSupport: { type: String, trim: true },
  useQrScanner: { type: String, trim: true },
  agreeTerms: { type: Boolean, default: false },
  agreeFee: { type: Boolean, default: false },
  digitalSignature: { type: Boolean, default: false },
  nationalIdNumber: { type: String, trim: true }
}, {
  timestamps: true
});

// Drop all existing indexes
organizerRegistrationSchema.indexes().forEach(index => {
  organizerRegistrationSchema.index(index[0], { unique: false });
});

// Create new non-unique indexes
organizerRegistrationSchema.index({ userId: 1 });
organizerRegistrationSchema.index({ status: 1 });
organizerRegistrationSchema.index({ 'eventDetails.eventDateTime': 1 });

const OrganizerRegistration = mongoose.model('OrganizerRegistration', organizerRegistrationSchema);
module.exports = OrganizerRegistration; 