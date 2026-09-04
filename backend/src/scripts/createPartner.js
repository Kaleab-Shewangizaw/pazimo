const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../../.env' });

// Was a hardcoded literal password, committed to a public repo — see
// docs/SECURITY_VULNERABILITIES.md. Now either takes PARTNER_SEED_PASSWORD
// from the environment or generates a random one and prints it once; never
// hardcode a real credential in a script that gets committed.
const createPartner = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if partner already exists
    const existingPartner = await User.findOne({ email: 'partner@pazimo.com' });
    if (existingPartner) {
      console.log('Partner user already exists');
      return;
    }

    const password = process.env.PARTNER_SEED_PASSWORD || crypto.randomBytes(12).toString('base64url');

    // Create partner user
    const partner = await User.create({
      firstName: 'Partner',
      lastName: 'User',
      email: 'partner@pazimo.com',
      phoneNumber: '+251911000000',
      password,
      role: 'partner',
      isActive: true,
      isPhoneVerified: true
    });

    console.log('Partner user created successfully:');
    console.log('Email:', partner.email);
    if (!process.env.PARTNER_SEED_PASSWORD) {
      console.log('Generated password (save this now, it is not stored anywhere else):', password);
    }

  } catch (error) {
    console.error('Error creating partner:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createPartner();