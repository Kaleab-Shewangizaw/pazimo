const User = require("../models/User");
const OrganizerRegistration = require("../models/OrganizerRegistration");
const Ticket = require("../models/Ticket");
const Withdrawal = require("../models/Withdrawal");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { isQueryOperatorInjection } = require("../utils/rejectQueryOperators");
const { stripAngleBrackets } = require("../utils/stripHtml");

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
      nationalIdNumber,
    } = req.body;

    const businessLicenseUrl = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    // Validate required fields
    if (!name || !email || !phone || !organization) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // See rejectQueryOperators.js — email/phone feed the $or filter right
    // below; without this a query-operator object here could match an
    // arbitrary existing account and report it as "already exists", or
    // (depending on shape) match nothing when it should.
    if (isQueryOperatorInjection(email) || isQueryOperatorInjection(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber: phone }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or phone number already exists",
      });
    }

    // Split name into firstName and lastName
    const nameParts = name.trim().split(/\s+/);
    const firstName = stripAngleBrackets(nameParts[0]);
    const lastName = stripAngleBrackets(
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName
    );

    // Create new user with organizer role
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber: phone,
      password,
      role: "organizer",
      isActive: false, // Set organizer as inactive by default
      isPhoneVerified: false, // Set phone as unverified by default
    });

    // Parse arrays/booleans from req.body if needed
    let parsedEventKinds = eventKinds;
    if (typeof eventKinds === "string") {
      try {
        parsedEventKinds = JSON.parse(eventKinds);
      } catch {
        parsedEventKinds = [eventKinds];
      }
    }
    let parsedEventDetails = eventDetails;
    if (typeof eventDetails === "string") {
      try {
        parsedEventDetails = JSON.parse(eventDetails);
      } catch {
        parsedEventDetails = {};
      }
    }
    let parsedAdditionalServices = additionalServices;
    if (typeof additionalServices === "string") {
      try {
        parsedAdditionalServices = JSON.parse(additionalServices);
      } catch {
        parsedAdditionalServices = {};
      }
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
      agreeTerms: agreeTerms === "true" || agreeTerms === true,
      agreeFee: agreeFee === "true" || agreeFee === true,
      digitalSignature:
        digitalSignature === "true" || digitalSignature === true,
      eventDetails: parsedEventDetails,
      additionalServices: parsedAdditionalServices,
      status: "pending",
      nationalIdNumber,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // Return success response
    res.status(201).json({
      success: true,
      message:
        "Organizer registered successfully. Please wait for admin approval.",
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
          additionalServices: organizerRegistration.additionalServices,
        },
      },
    });
  } catch (error) {
    console.error("Organizer registration error:", error);
    if (error.name === "ValidationError") {
      const errors = {};
      for (let field in error.errors) {
        errors[field] = { message: error.errors[field].message };
      }
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to register organizer",
    });
  }
};

// Get organizer profile
exports.getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update organizer profile
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const userId = req.user.userId;

    // Check if email is already used by another user
    if (email) {
      const existingEmail = await User.findOne({
        email,
        _id: { $ne: userId },
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }
    }

    // Check if phone number is already used by another user
    if (phoneNumber) {
      const existingPhone = await User.findOne({
        phoneNumber,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered",
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
        phoneNumber,
      },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update password
exports.updatePassword = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    console.log("Password update request received:", {
      userId: req.user.userId,
      hasCurrentPassword: !!req.body.currentPassword,
      hasNewPassword: !!req.body.newPassword,
    });

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    // Get user with password
    const user = await User.findById(userId).select("+password");
    console.log("User found:", !!user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check current password using the model's method
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    console.log("Password check result:", isPasswordCorrect);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is same as current
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password (the pre-save hook will hash it)
    user.password = newPassword;
    await user.save();
    console.log("Password updated successfully");

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update password",
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
      .populate("userId", "firstName lastName email phoneNumber")
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
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching organizer registrations:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch organizer registrations",
    });
  }
};

// Update registration status
exports.updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "approved" or "rejected"',
      });
    }

    const registration = await OrganizerRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Update registration status
    registration.status = status;
    if (adminNotes) {
      registration.adminNotes = adminNotes;
    }

    // If approved, activate the user and update their status
    if (status === "approved") {
      await User.findByIdAndUpdate(registration.userId, {
        isActive: true,
        status: "active",
      });
    }

    await registration.save();

    res.status(200).json({
      success: true,
      message: `Registration ${status} successfully`,
      data: registration,
    });
  } catch (error) {
    console.error("Error updating registration status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update registration status",
    });
  }
};

// Get Top Customers for Organizer
exports.getTopCustomers = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const { limit = 10 } = req.query;

    if (!organizerId) {
      return res.status(400).json({
        success: false,
        message: "Organizer ID is required",
      });
    }

    const topCustomers = await Ticket.aggregate([
      // 1. Lookup events to filter by organizer
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      { $unwind: "$eventDetails" },
      // 2. Filter tickets for this organizer's events and ensure they are active/used (excluding invitation tickets)
      {
        $match: {
          "eventDetails.organizer": new mongoose.Types.ObjectId(organizerId),
          status: { $in: ["active", "used", "confirmed"] },
          isInvitation: { $ne: true },
        },
      },
      // 3. Lookup user info to get phone number if user field exists
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userData",
        },
      },
      {
        $addFields: {
          userObj: { $arrayElemAt: ["$userData", 0] },
        },
      },
      // 4. Normalize Phone and Name
      {
        $addFields: {
          finalPhone: {
            $ifNull: ["$userObj.phoneNumber", "$guestPhone"],
          },
          finalName: {
            $cond: {
              if: { $gt: [{ $strLenCP: { $ifNull: ["$userObj.firstName", ""] } }, 0] },
              then: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$userObj.firstName", ""] },
                      " ",
                      { $ifNull: ["$userObj.lastName", ""] },
                    ],
                  },
                },
              },
              else: { $ifNull: ["$guestName", "Guest"] },
            },
          },
          qty: {
            $ifNull: ["$purchaseQuantity", "$ticketCount", 1],
          },
        },
      },
      // 5. Group by Phone
      {
        $group: {
          _id: "$finalPhone",
          name: { $first: "$finalName" },
          totalTickets: { $sum: "$qty" },
          totalSpent: { $sum: "$price" },
          eventsAttended: { $addToSet: "$event" },
          lastEventDate: { $max: "$eventDetails.startDate" },
        },
      },
      // 6. Filter out null phones (shouldn't happen for valid tickets but safe to have)
      {
        $match: {
          _id: { $ne: null },
        },
      },
      // 7. Sort by totalTickets desc
      { $sort: { totalTickets: -1 } },
      // 8. Limit
      { $limit: parseInt(limit) },
    ]);

    const formatted = topCustomers.map((c) => ({
      phone: c._id,
      name: c.name,
      totalTickets: c.totalTickets,
      totalSpent: c.totalSpent,
      eventsCount: c.eventsAttended.length,
      lastActive: c.lastEventDate,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("Get Top Customers Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top customers",
      error: error.message,
    });
  }
};

// Get organizer dashboard stats (OPTIMIZED)
exports.getOrganizerDashboard = async (req, res) => {
  try {
    const organizerId = req.params.organizerId || req.user?.userId;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    if (!organizerId) {
      return res.status(400).json({
        success: false,
        message: "Organizer ID is required",
      });
    }

    // Use aggregation to get all dashboard data efficiently
    const dashboardData = await Event.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
        },
      },
      {
        $lookup: {
          from: "tickets",
          localField: "_id",
          foreignField: "event",
          as: "tickets",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $unwind: {
          path: "$categoryData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          // Filter tickets with price > 0
          paidTickets: {
            $filter: {
              input: "$tickets",
              as: "ticket",
              cond: {
                $and: [
                  { $gt: ["$$ticket.price", 0] },
                  ...(currency === "ETB"
                    ? [
                        {
                          $or: [
                            { $eq: ["$$ticket.currency", "ETB"] },
                            { $eq: [{ $type: "$$ticket.currency" }, "missing"] },
                          ],
                        },
                      ]
                    : [{ $eq: ["$$ticket.currency", "USD"] }]),
                ],
              },
            },
          },
          // Calculate ticket stats
          ticketStats: {
            total: { $size: "$tickets" },
            active: {
              $size: {
                $filter: {
                  input: "$tickets",
                  as: "ticket",
                  cond: { $eq: ["$$ticket.status", "active"] },
                },
              },
            },
            used: {
              $size: {
                $filter: {
                  input: "$tickets",
                  as: "ticket",
                  cond: { $eq: ["$$ticket.status", "used"] },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          revenue: { $sum: "$paidTickets.price" },
          organizerRevenue: { $multiply: [{ $sum: "$paidTickets.price" }, 0.97] },
          pazimoCommission: { $multiply: [{ $sum: "$paidTickets.price" }, 0.03] },
          category: {
            _id: "$categoryData._id",
            name: "$categoryData.name",
            description: "$categoryData.description",
          },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          category: 1,
          startDate: 1,
          endDate: 1,
          startTime: 1,
          endTime: 1,
          location: 1,
          coverImages: 1,
          ticketTypes: 1,
          status: 1,
          capacity: 1,
          tags: 1,
          createdAt: 1,
          updatedAt: 1,
          tickets: 1,
          ticketStats: 1,
          revenue: 1,
          organizerRevenue: 1,
          pazimoCommission: 1,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    // Get withdrawal data in parallel
    const withdrawalCurrencyMatch =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };

    const withdrawalData = await Withdrawal.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
          ...withdrawalCurrencyMatch,
        },
      },
      {
        $facet: {
          withdrawals: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 }, // Get recent withdrawals
          ],
          stats: [
            {
              $group: {
                _id: null,
                totalWithdrawn: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["approved", "completed"]] },
                      "$amount",
                      0,
                    ],
                  },
                },
                pendingWithdrawals: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    // Calculate overall stats
    const totalRevenue = dashboardData.reduce((sum, e) => sum + (e.revenue || 0), 0);
    const organizerRevenue = dashboardData.reduce((sum, e) => sum + (e.organizerRevenue || 0), 0);
    const pazimoCommission = dashboardData.reduce((sum, e) => sum + (e.pazimoCommission || 0), 0);

    const withdrawalStats = withdrawalData[0]?.stats[0] || {
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
    };

    const availableBalance = organizerRevenue - withdrawalStats.totalWithdrawn - withdrawalStats.pendingWithdrawals;

    res.status(200).json({
      success: true,
      data: {
        events: dashboardData,
        withdrawals: withdrawalData[0]?.withdrawals || [],
        balance: {
          currency,
          totalRevenue,
          organizerRevenue,
          pazimoCommission,
          totalWithdrawn: withdrawalStats.totalWithdrawn,
          pendingWithdrawals: withdrawalStats.pendingWithdrawals,
          availableBalance,
        },
        stats: {
          totalEvents: dashboardData.length,
          publishedEvents: dashboardData.filter(e => e.status === "published").length,
          draftEvents: dashboardData.filter(e => e.status === "draft").length,
          completedEvents: dashboardData.filter(e => new Date(e.endDate) < new Date()).length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching organizer dashboard:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch organizer dashboard",
    });
  }
};

// Get organizer dashboard stats (OPTIMIZED)
exports.getOrganizerDashboard = async (req, res) => {
  try {
    const organizerId = req.params.organizerId || req.user?.userId;
    const currency = req.query.currency === "USD" ? "USD" : "ETB";

    if (!organizerId) {
      return res.status(400).json({
        success: false,
        message: "Organizer ID is required",
      });
    }

    // Use aggregation to get all dashboard data efficiently
    const dashboardData = await Event.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
        },
      },
      {
        $lookup: {
          from: "tickets",
          localField: "_id",
          foreignField: "event",
          as: "tickets",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $unwind: {
          path: "$categoryData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          // Filter tickets with price > 0
          paidTickets: {
            $filter: {
              input: "$tickets",
              as: "ticket",
              cond: {
                $and: [
                  { $gt: ["$$ticket.price", 0] },
                  ...(currency === "ETB"
                    ? [
                        {
                          $or: [
                            { $eq: ["$$ticket.currency", "ETB"] },
                            { $eq: [{ $type: "$$ticket.currency" }, "missing"] },
                          ],
                        },
                      ]
                    : [{ $eq: ["$$ticket.currency", "USD"] }]),
                ],
              },
            },
          },
          // Calculate ticket stats
          ticketStats: {
            total: { $size: "$tickets" },
            active: {
              $size: {
                $filter: {
                  input: "$tickets",
                  as: "ticket",
                  cond: { $eq: ["$$ticket.status", "active"] },
                },
              },
            },
            used: {
              $size: {
                $filter: {
                  input: "$tickets",
                  as: "ticket",
                  cond: { $eq: ["$$ticket.status", "used"] },
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          revenue: { $sum: "$paidTickets.price" },
          organizerRevenue: { $multiply: [{ $sum: "$paidTickets.price" }, 0.97] },
          pazimoCommission: { $multiply: [{ $sum: "$paidTickets.price" }, 0.03] },
          category: {
            _id: "$categoryData._id",
            name: "$categoryData.name",
            description: "$categoryData.description",
          },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          category: 1,
          startDate: 1,
          endDate: 1,
          startTime: 1,
          endTime: 1,
          location: 1,
          coverImages: 1,
          ticketTypes: 1,
          status: 1,
          capacity: 1,
          tags: 1,
          createdAt: 1,
          updatedAt: 1,
          tickets: 1,
          ticketStats: 1,
          revenue: 1,
          organizerRevenue: 1,
          pazimoCommission: 1,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    // Get withdrawal data in parallel
    const withdrawalCurrencyMatch =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };

    const withdrawalData = await Withdrawal.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
          ...withdrawalCurrencyMatch,
        },
      },
      {
        $facet: {
          withdrawals: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 }, // Get recent withdrawals
          ],
          stats: [
            {
              $group: {
                _id: null,
                totalWithdrawn: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", ["approved", "completed"]] },
                      "$amount",
                      0,
                    ],
                  },
                },
                pendingWithdrawals: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

    // Calculate overall stats
    const totalRevenue = dashboardData.reduce((sum, e) => sum + (e.revenue || 0), 0);
    const organizerRevenue = dashboardData.reduce((sum, e) => sum + (e.organizerRevenue || 0), 0);
    const pazimoCommission = dashboardData.reduce((sum, e) => sum + (e.pazimoCommission || 0), 0);

    const withdrawalStats = withdrawalData[0]?.stats[0] || {
      totalWithdrawn: 0,
      pendingWithdrawals: 0,
    };

    const availableBalance = organizerRevenue - withdrawalStats.totalWithdrawn - withdrawalStats.pendingWithdrawals;

    res.status(200).json({
      success: true,
      data: {
        events: dashboardData,
        withdrawals: withdrawalData[0]?.withdrawals || [],
        balance: {
          currency,
          totalRevenue,
          organizerRevenue,
          pazimoCommission,
          totalWithdrawn: withdrawalStats.totalWithdrawn,
          pendingWithdrawals: withdrawalStats.pendingWithdrawals,
          availableBalance,
        },
        stats: {
          totalEvents: dashboardData.length,
          publishedEvents: dashboardData.filter(e => e.status === "published").length,
          draftEvents: dashboardData.filter(e => e.status === "draft").length,
          completedEvents: dashboardData.filter(e => new Date(e.endDate) < new Date()).length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching organizer dashboard:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch organizer dashboard",
    });
  }
};
