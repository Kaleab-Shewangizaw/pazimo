const User = require('../models/User');
const OrganizerRegistration = require('../models/OrganizerRegistration');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Sign up organizer
exports.signUp = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      organization,
      password,
      organizerType,
      organizerTypeOther,
      socialLinks,
      tinNumber,
      businessAddress,
      bankAccountHolder,
      bankName,
      bankAccountNumber,
      contactRole,
      hasOrganizedBefore,
      eventKinds,
      eventKindOther,
      sampleEventName,
      estimatedAudience,
      eventFrequency,
      payoutMethod,
      needSupport,
      useQrScanner,
      agreeTerms,
      agreeFee,
      digitalSignature,
      eventDetails,
      additionalServices = {},
      nationalIdNumber
    } = req.body;

    const businessLicenseUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate required fields
    if (!name || !email || !phone || !organization) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phoneNumber: phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone number already exists'
      });
    }

    // Split name into firstName and lastName
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

    // Create new user with organizer role
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber: phone,
      password,
      role: 'organizer',
      isActive: false, // Set organizer as inactive by default
      isPhoneVerified: false // Set phone as unverified by default
    });

    // Parse arrays/booleans from req.body if needed
    let parsedEventKinds = eventKinds;
    if (typeof eventKinds === 'string') {
      try { parsedEventKinds = JSON.parse(eventKinds); } catch { parsedEventKinds = [eventKinds]; }
    }
    let parsedEventDetails = eventDetails;
    if (typeof eventDetails === 'string') {
      try { parsedEventDetails = JSON.parse(eventDetails); } catch { parsedEventDetails = {}; }
    }
    let parsedAdditionalServices = additionalServices;
    if (typeof additionalServices === 'string') {
      try { parsedAdditionalServices = JSON.parse(additionalServices); } catch { parsedAdditionalServices = {}; }
    }

    // Create organizer registration with all fields
    const organizerRegistration = await OrganizerRegistration.create({
      userId: user._id,
      organization,
      email,
      phoneNumber: phone,
      organizerType,
      organizerTypeOther,
      socialLinks,
      businessLicenseUrl,
      tinNumber,
      businessAddress,
      bankAccountHolder,
      bankName,
      bankAccountNumber,
      contactRole,
      hasOrganizedBefore,
      eventKinds: parsedEventKinds,
      eventKindOther,
      sampleEventName,
      estimatedAudience,
      eventFrequency,
      payoutMethod,
      needSupport,
      useQrScanner,
      agreeTerms: agreeTerms === 'true' || agreeTerms === true,
      agreeFee: agreeFee === 'true' || agreeFee === true,
      digitalSignature: digitalSignature === 'true' || digitalSignature === true,
      eventDetails: parsedEventDetails,
      additionalServices: parsedAdditionalServices,
      status: 'pending',
      nationalIdNumber
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Organizer registered successfully. Please wait for admin approval.',
      token,
      organizer: {
        _id: user._id,
        name,
        email,
        phone,
        organization,
        isActive: false,
        isPhoneVerified: false,
        registration: {
          _id: organizerRegistration._id,
          status: organizerRegistration.status,
          eventDetails: organizerRegistration.eventDetails,
          additionalServices: organizerRegistration.additionalServices
        }
      }
    });

  } catch (error) {
    console.error('Organizer registration error:', error);
    if (error.name === 'ValidationError') {
      const errors = {};
      for (let field in error.errors) {
        errors[field] = { message: error.errors[field].message };
      }
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register organizer'
    });
  }
};

// Get organizer profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update organizer profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    const userId = req.user.userId;

    // Check if email is already used by another user
    if (email) {
      const existingEmail = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Check if phone number is already used by another user
    if (phoneNumber) {
      const existingPhone = await User.findOne({ 
        phoneNumber, 
        _id: { $ne: userId } 
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered'
        });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { 
        firstName, 
        lastName, 
        email, 
        phoneNumber
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    console.log('Password update request received:', {
      userId: req.user.userId,
      hasCurrentPassword: !!req.body.currentPassword,
      hasNewPassword: !!req.body.newPassword
    });

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(userId).select('+password');
    console.log('User found:', !!user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password using the model's method
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    console.log('Password check result:', isPasswordCorrect);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is same as current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password (the pre-save hook will hash it)
    user.password = newPassword;
    await user.save();
    console.log('Password updated successfully');

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update password'
    });
  }
};

// Get all organizer registrations with pagination
exports.getRegistrations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await OrganizerRegistration.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Fetch registrations with populated user data
    const registrations = await OrganizerRegistration.find()
      .populate('userId', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        registrations,
        currentPage: page,
        totalPages,
        total,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching organizer registrations:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch organizer registrations'
    });
  }
};

// Update registration status
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "approved" or "rejected"'
      });
    }

    const registration = await OrganizerRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    // Update registration status
    registration.status = status;
    if (adminNotes) {
      registration.adminNotes = adminNotes;
    }

    // If approved, activate the user and update their status
    if (status === 'approved') {
      await User.findByIdAndUpdate(registration.userId, {
        isActive: true,
        status: 'active'
      });
    }

    await registration.save();

    res.status(200).json({
      success: true,
      message: `Registration ${status} successfully`,
      data: registration
    });
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update registration status'
    });
  }
}; 