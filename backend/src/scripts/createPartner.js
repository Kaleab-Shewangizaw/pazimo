const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../../.env' });

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

    // Create partner user
    const partner = await User.create({
      firstName: 'Partner',
      lastName: 'User',
      email: 'partner@pazimo.com',
      phoneNumber: '+251911000000',
      password: 'XtwiYfpVJ28@kft',
      role: 'partner',
      isActive: true,
      isPhoneVerified: true
    });

    console.log('Partner user created successfully:');
    // console.log('Email: partner@pazimo.com');
    // console.log('Password: XtwiYfpVJ28@kft');
    // console.log('Role: partner');

  } catch (error) {
    console.error('Error creating partner:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

createPartner();