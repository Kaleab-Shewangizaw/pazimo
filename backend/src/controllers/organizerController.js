const User = require("../models/User");
const OrganizerRegistration = require("../models/OrganizerRegistration");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Event = require("../models/Event");
const Withdrawal = require("../models/Withdrawal");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const {
  getOrganizerEventIds,
  validTicketMatch,
  revenueAccumulators,
} = require("../utils/ticketRevenueQuery");
const { isQueryOperatorInjection } = require("../utils/rejectQueryOperators");
const { stripAngleBrackets } = require("../utils/stripHtml");
const { getOrganizerLoanFinance } = require("../services/loanRepaymentService");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

// Best-effort cleanup of a replaced/deleted local upload, mirroring
// beverageController's removeUploadedImage. Never throws: a leftover file is
// untidy, a failed request because of one is worse.
const removeUploadedFile = (filePath) => {
  if (!filePath || typeof filePath !== "string") return;
  const filename = path.basename(filePath);
  if (!filename || filename === "." || filename === "..") return;

  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove profile picture:", error.message);
    }
  });
};

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

    // organization lives on OrganizerRegistration (the sign-up application),
    // not on User — join it in here so the profile screen has a single flat
    // shape to read from, same as updateProfile below.
    const registration = await OrganizerRegistration.findOne({
      userId: user._id,
    }).select("organization");

    res.status(200).json({
      success: true,
      data: { ...user.toObject(), organization: registration?.organization ?? null },
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
    const { firstName, lastName, email, phoneNumber, organization } = req.body;

    if (organization !== undefined && !organization.trim()) {
      return res.status(400).json({
        success: false,
        message: "Organization name is required",
      });
    }

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const userId = req.user.userId;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Global uniqueness — one phone number belongs to exactly one account,
    // full stop, same as email. No role-based carve-out: a phone number
    // already used by any other account (any role) is rejected. Only
    // checked when the value is actually changing, so saving your own
    // unchanged email/phone never trips a false "already registered" —
    // that was the real bug, not the uniqueness rule itself.
    if (email && email !== currentUser.email) {
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

    if (phoneNumber && phoneNumber !== currentUser.phoneNumber) {
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

    // organization lives on the sign-up OrganizerRegistration, not User —
    // update it there when present, otherwise just read back the current
    // value so the response shape always matches getProfile's.
    const registration = organization !== undefined
      ? await OrganizerRegistration.findOneAndUpdate(
          { userId },
          { organization: organization.trim() },
          { new: true },
        ).select("organization")
      : await OrganizerRegistration.findOne({ userId }).select("organization");

    res.status(200).json({
      success: true,
      data: { ...user.toObject(), organization: registration?.organization ?? null },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update organizer profile picture
exports.updateProfilePicture = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      removeUploadedFile(`/uploads/${req.file.filename}`);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const previousImage = user.profilePicture;
    user.profilePicture = `/uploads/${req.file.filename}`;
    await user.save();

    if (previousImage && previousImage !== user.profilePicture) {
      removeUploadedFile(previousImage);
    }

    const sanitized = await User.findById(user._id).select("-password");
    const registration = await OrganizerRegistration.findOne({
      userId: user._id,
    }).select("organization");
    res.status(200).json({
      success: true,
      data: { ...sanitized.toObject(), organization: registration?.organization ?? null },
    });
  } catch (error) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    console.error("Error updating profile picture:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update profile picture",
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

    // Resolve the organizer's events first so the ticket scan is bounded.
    //
    // This pipeline used to join every ticket in the collection to its event,
    // $unwind it, and only then filter on eventDetails.organizer — an unindexed
    // filter after a join, so it walked the whole collection every time the
    // organizer dashboard loaded. Matching on `event: { $in: [...] }` uses the
    // ticket indexes that lead with `event`.
    const organizerEventIds = await getOrganizerEventIds(organizerId);
    if (organizerEventIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const topCustomers = await Ticket.aggregate([
      // 1. Only this organizer's tickets, active/used, excluding invitations
      {
        $match: {
          event: { $in: organizerEventIds },
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

    // Sum purchaseQuantity/ticketCount per ticket document (falling back to
    // 1), not just the document count: a single Ticket document can
    // represent a multi-ticket purchase, so counting documents undercounts
    // against what getEventTickets reports for the same event.
    const TICKET_QTY_EXPR = {
      $ifNull: ["$purchaseQuantity", { $ifNull: ["$ticketCount", 1] }],
    };

    // Use aggregation to get all dashboard data efficiently.
    //
    // This used to $lookup every ticket document onto its event (as: "tickets")
    // and filter/sum over that array in-pipeline. For an organizer with enough
    // ticket volume — especially older tickets still carrying the ~43 KB
    // base64 QR blob organizerOverviewController's history note describes —
    // a single event's joined document could exceed MongoDB's 16MB limit
    // ("BSONObj size ... is invalid"), and nothing downstream even reads that
    // raw array (DashboardEvent only needs ticketStats/revenue figures).
    // Each $lookup below instead reduces the join to one small summary row
    // per event, computed inside the tickets collection itself, so the
    // result size no longer grows with ticket count.
    const dashboardData = await Event.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
        },
      },
      {
        $lookup: {
          from: "tickets",
          let: { eventId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$event", "$$eventId"] } } },
            {
              $group: {
                _id: null,
                total: { $sum: TICKET_QTY_EXPR },
                active: {
                  $sum: { $cond: [{ $eq: ["$status", "active"] }, TICKET_QTY_EXPR, 0] },
                },
                used: {
                  $sum: { $cond: [{ $eq: ["$status", "used"] }, TICKET_QTY_EXPR, 0] },
                },
              },
            },
          ],
          as: "ticketCountRows",
        },
      },
      {
        $lookup: {
          from: "tickets",
          let: { eventId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$event", "$$eventId"] },
                ...validTicketMatch(currency),
              },
            },
            { $group: { _id: null, ...revenueAccumulators() } },
          ],
          as: "revenueRows",
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
          ticketStats: {
            total: { $ifNull: [{ $arrayElemAt: ["$ticketCountRows.total", 0] }, 0] },
            active: { $ifNull: [{ $arrayElemAt: ["$ticketCountRows.active", 0] }, 0] },
            used: { $ifNull: [{ $arrayElemAt: ["$ticketCountRows.used", 0] }, 0] },
          },
          // Split per ticket at the rates it was sold under; a flat 0.97/0.03
          // is wrong for any event off the default and for any event whose VAT
          // Pazimo covers — revenueAccumulators() (same helper
          // organizerOverviewController uses) already does that per row.
          revenue: { $ifNull: [{ $arrayElemAt: ["$revenueRows.grossRevenue", 0] }, 0] },
          organizerRevenue: {
            $ifNull: [{ $arrayElemAt: ["$revenueRows.organizerRevenue", 0] }, 0],
          },
          pazimoCommission: {
            $ifNull: [{ $arrayElemAt: ["$revenueRows.pazimoCommission", 0] }, 0],
          },
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
    //
    // Scoped to the ticket stream only, same reasoning as
    // organizerOverviewController's admin list: availableBalance below is a
    // TICKET balance, so a beverage or Pazimo Capital withdrawal must not be
    // subtracted from it. Rows written before the stream split carry no
    // `stream` at all and are ticket revenue.
    const withdrawalCurrencyMatch =
      currency === "ETB"
        ? { $or: [{ currency: "ETB" }, { currency: { $exists: false } }] }
        : { currency: "USD" };

    const withdrawalData = await Withdrawal.aggregate([
      {
        $match: {
          organizer: new mongoose.Types.ObjectId(organizerId),
          $and: [
            withdrawalCurrencyMatch,
            { $or: [{ stream: "tickets" }, { stream: { $exists: false } }] },
          ],
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

    // Pazimo Capital's principal is its own pool (see financeService's
    // `capital` stream) and never added here. Only its automatic
    // 60%-of-ticket-sales repayment touches this ticket balance, matching
    // financeService.calculateOrganizerBalance's ticketAvailableBalance —
    // the same identity the withdrawal gate uses, so this display and that
    // gate always agree.
    const loanFinance = await getOrganizerLoanFinance(organizerId, currency);
    const availableBalance = Math.max(
      0,
      organizerRevenue -
        loanFinance.totalRepaidFromTickets -
        withdrawalStats.totalWithdrawn -
        withdrawalStats.pendingWithdrawals
    );

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
          capitalPrincipalCredited: loanFinance.principalCredited,
          capitalRepaidFromTickets: loanFinance.totalRepaidFromTickets,
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
