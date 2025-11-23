const mongoose = require('mongoose');
const getConnectionStatus = require('../utils/dbStatus');

const connectDB = async () => {
  try {
    // Connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      heartbeatFrequencyMS: 2000, // Check server status every 2 seconds
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    // Log initial connection
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Monitor connection events
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
      console.log('Connection Status:', getConnectionStatus());
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      console.log('Connection Status:', getConnectionStatus());
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      console.log('Connection Status:', getConnectionStatus());
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB disconnection:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log('Connection Status:', getConnectionStatus());
    process.exit(1);
  }
};

module.exports = connectDB; 