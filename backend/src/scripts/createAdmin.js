require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const adminData = {
      email: process.env.ADMIN_EMAIL || 'admin@pazimo.com',
      password: process.env.ADMIN_PASSWORD || 'password',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      phoneNumber: process.env.ADMIN_PHONE || '1234567890'
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const admin = await User.create(adminData);
    console.log('Admin user created successfully:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
};

createAdmin(); 