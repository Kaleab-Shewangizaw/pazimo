require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const verifyAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ role: 'admin' });
    
    if (admin) {
      console.log('Admin user found:');
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
    } else {
      console.log('No admin user found. Creating one...');
      
      const newAdmin = await User.create({
        email: 'admin@example.com',
        password: 'Admin@123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        phoneNumber: '1234567890'
      });

      console.log('Admin user created:');
      console.log('Email:', newAdmin.email);
      console.log('Role:', newAdmin.role);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

verifyAdmin(); 