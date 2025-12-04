const User = require('../models/User');

// Get store statistics (for organizers)
exports.getStoreStats = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }

    if (req.user.role !== 'organizer') {
      return res.status(403).json({
        status: 'error',
        message: 'Only organizers can access store statistics'
      });
    }

    // Example store statistics
    const stats = {
      totalCustomers: await User.countDocuments({ role: 'customer' }),
      totalOrders: 0, // You would implement this based on your order model
      revenue: 0, // You would implement this based on your order model
      activeProducts: 0 // You would implement this based on your product model
    };

    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get user's store profile
exports.getStoreProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }

    const user = await User.findById(req.user.id);
    user.password = undefined;

    const profileData = {
      user,
      storePreferences: {
        // Add store-specific preferences here
        notifications: true,
        theme: 'light',
        language: 'en'
      }
    };

    res.status(200).json({
      status: 'success',
      data: profileData
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Update store preferences
exports.updateStorePreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'User not authenticated'
      });
    }
    
    // Update user's store preferences
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { storePreferences: preferences } },
      { new: true, runValidators: true }
    );

    user.password = undefined;

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
}; 