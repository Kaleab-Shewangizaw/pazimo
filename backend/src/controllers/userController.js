const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Withdrawal = require('../models/Withdrawal');
const mongoose = require('mongoose');

// Get all users (simple version)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const role = req.query.role; // Get role from query parameters

    // Build query object
    const query = {};
    if (role) {
      query.role = role; // Add role filter if provided
    }

    // Get total count of users with role filter
    const total = await User.countDocuments(query);

    // Get paginated users with role filter
    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(); // Use lean for better performance
    
    res.status(200).json({
      status: 'success',
      data: { 
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get organizers with aggregated data (OPTIMIZED for admin dashboard)
exports.getOrganizersWithStats = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count
    const total = await User.countDocuments({ role: 'organizer' });

    // Use aggregation pipeline to fetch organizers with all their data efficiently
    const organizers = await User.aggregate([
      {
        $match: { role: 'organizer' }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      // Lookup events for each organizer
      {
        $lookup: {
          from: 'events',
          localField: '_id',
          foreignField: 'organizer',
          as: 'events'
        }
      },
      // Lookup tickets for revenue calculation
      {
        $lookup: {
          from: 'tickets',
          let: { organizerId: '$_id' },
          pipeline: [
            {
              $lookup: {
                from: 'events',
                localField: 'event',
                foreignField: '_id',
                as: 'eventData'
              }
            },
            {
              $unwind: '$eventData'
            },
            {
              $match: {
                $expr: { $eq: ['$eventData.organizer', '$$organizerId'] },
                price: { $gt: 0 },
                status: { $nin: ['cancelled', 'failed', 'expired'] }
              }
            },
            {
              $project: {
                price: 1,
                purchaseQuantity: 1,
                ticketCount: 1,
                isInvitation: 1,
                status: 1
              }
            }
          ],
          as: 'tickets'
        }
      },
      // Lookup withdrawals
      {
        $lookup: {
          from: 'withdrawals',
          localField: '_id',
          foreignField: 'organizer',
          as: 'withdrawals'
        }
      },
      // Calculate stats
      {
        $addFields: {
          totalEvents: { $size: '$events' },
          activeEvents: {
            $size: {
              $filter: {
                input: '$events',
                as: 'event',
                cond: { $eq: ['$$event.status', 'published'] }
              }
            }
          },
          // Calculate revenues
          totalRevenue: { $sum: '$tickets.price' },
          organizerRevenue: { $multiply: [{ $sum: '$tickets.price' }, 0.97] },
          pazimoCommission: { $multiply: [{ $sum: '$tickets.price' }, 0.03] },
          // Calculate total tickets sold (with quantities)
          totalTicketsSold: {
            $sum: {
              $map: {
                input: '$tickets',
                as: 'ticket',
                in: {
                  $cond: [
                    { $gt: ['$$ticket.purchaseQuantity', 0] },
                    '$$ticket.purchaseQuantity',
                    { $cond: [{ $gt: ['$$ticket.ticketCount', 0] }, '$$ticket.ticketCount', 1] }
                  ]
                }
              }
            }
          },
          // Calculate withdrawn and pending amounts
          totalWithdrawn: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$withdrawals',
                    as: 'w',
                    cond: { $in: ['$$w.status', ['approved', 'completed']] }
                  }
                },
                as: 'withdrawal',
                in: '$$withdrawal.amount'
              }
            }
          },
          pendingWithdrawals: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$withdrawals',
                    as: 'w',
                    cond: { $eq: ['$$w.status', 'pending'] }
                  }
                },
                as: 'withdrawal',
                in: '$$withdrawal.amount'
              }
            }
          }
        }
      },
      // Calculate available balance
      {
        $addFields: {
          availableBalance: {
            $subtract: [
              '$organizerRevenue',
              { $add: ['$totalWithdrawn', '$pendingWithdrawals'] }
            ]
          }
        }
      },
      // Project only needed fields
      {
        $project: {
          password: 0,
          withdrawals: 0,
          tickets: 0
        }
      }
    ]);

    // Calculate overall stats
    const stats = {
      totalOrganizers: total,
      totalEvents: organizers.reduce((sum, org) => sum + org.totalEvents, 0),
      activeEvents: organizers.reduce((sum, org) => sum + org.activeEvents, 0),
      totalRevenue: organizers.reduce((sum, org) => sum + (org.totalRevenue || 0), 0),
      organizerRevenue: organizers.reduce((sum, org) => sum + (org.organizerRevenue || 0), 0),
      pazimoCommission: organizers.reduce((sum, org) => sum + (org.pazimoCommission || 0), 0),
      totalTicketsSold: organizers.reduce((sum, org) => sum + (org.totalTicketsSold || 0), 0)
    };

    // Log for debugging
    console.log('👥 Organizers Stats Summary:', {
      totalOrganizers: stats.totalOrganizers,
      totalEvents: stats.totalEvents,
      totalTicketsSold: stats.totalTicketsSold,
      totalRevenue: stats.totalRevenue
    });

    res.status(200).json({
      status: 'success',
      data: { 
        users: organizers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching organizers with stats:', error);
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get single user
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

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

// Create user
exports.createUser = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already registered'
      });
    }

    // Check if phone number exists
    const existingPhone = await User.findOne({ phoneNumber });
    if (existingPhone) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number already registered'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      role
    });

    // Remove password from output
    user.password = undefined;

    res.status(201).json({
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

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, role } = req.body;
    const userId = req.params.id;

    // Check if phone number is already used by another user
    if (phoneNumber) {
      const existingPhone = await User.findOne({ 
        phoneNumber, 
        _id: { $ne: userId } 
      });
      if (existingPhone) {
        return res.status(400).json({
          status: 'error',
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
        phoneNumber, 
        role 
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

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

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
}; 