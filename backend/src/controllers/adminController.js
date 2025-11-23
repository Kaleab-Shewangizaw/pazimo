const User = require('../models/User');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const Withdrawal = require('../models/Withdrawal');
const { StatusCodes } = require('http-status-codes');

// Get admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get total events
    const totalEvents = await Event.countDocuments();
    
    // Get active events (published)
    const activeEvents = await Event.countDocuments({ status: 'published' });
    
    // Get total revenue from tickets
    const tickets = await Ticket.find();
    const totalRevenue = tickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0);
    
    // Get active organizers
    const activeOrganizers = await User.countDocuments({ role: 'organizer' });
    
    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.countDocuments({ status: 'pending' });

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        totalUsers,
        totalEvents,
        totalRevenue,
        activeOrganizers,
        activeEvents,
        pendingWithdrawals
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get dashboard statistics'
    });
  }
};

const getRevenueChartData = async (req, res) => {
  try {
    const revenueData = await Ticket.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalRevenue: { $sum: '$price' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const formattedData = revenueData.map(item => ({
      name: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.totalRevenue
    }));

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error getting revenue chart data:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get revenue chart data'
    });
  }
};

const getEventRegistrationsChartData = async (req, res) => {
  try {
    const eventData = await Event.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          eventCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const formattedData = eventData.map(item => ({
      name: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.eventCount
    }));

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: formattedData
    });
  } catch (error) {
    console.error('Error getting event registrations chart data:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get event registrations chart data'
    });
  }
};

module.exports = {
  getDashboardStats,
  getRevenueChartData,
  getEventRegistrationsChartData,
}; 