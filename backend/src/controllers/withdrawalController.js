const Withdrawal = require('../models/Withdrawal');
const Event = require('../models/Event');
const Ticket = require('../models/Ticket');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');
const Notification = require("../models/Notification");

// Get organizer's available balance
const getOrganizerBalance = async (req, res) => {
  try {
    const { organizerId } = req.params;

    // Get all events by this organizer
    const events = await Event.find({ organizer: organizerId });
    const eventIds = events.map(event => event._id);

    // Calculate revenue from tickets
    // Count all tickets that represent actual revenue (active, used, etc.) excluding cancelled/expired
    // Business logic: All paid tickets contribute to revenue regardless of usage status
    const tickets = await Ticket.find({
      event: { $in: eventIds },
      status: { $nin: ["cancelled", "expired"] }, // Include all statuses except cancelled/expired
    }).populate('event', 'title ticketTypes');

    // Calculate total revenue and breakdown by event
    const revenueBreakdown = events.map(event => {
      const eventTickets = tickets.filter(ticket => 
        ticket.event._id.toString() === event._id.toString()
      );
      
      const eventRevenue = eventTickets.reduce((sum, ticket) => sum + ticket.price, 0);
      
      // Get ticket type breakdown
      const ticketTypeBreakdown = event.ticketTypes.map(ticketType => {
        const typeTickets = eventTickets.filter(t => t.ticketType === ticketType.name);
        const typeRevenue = typeTickets.reduce((sum, t) => sum + t.price, 0);
        const quantitySold = typeTickets.length;
        
        return {
          name: ticketType.name,
          price: ticketType.price,
          quantitySold,
          revenue: typeRevenue
        };
      });

      return {
        eventId: event._id,
        eventTitle: event.title,
        totalRevenue: eventRevenue,
        ticketTypeBreakdown,
        totalTicketsSold: eventTickets.length
      };
    });

    // Calculate total revenue across all events
    const totalRevenue = revenueBreakdown.reduce((sum, event) => sum + event.totalRevenue, 0);
    
    // Calculate revenue breakdown by ticket status
    const statusBreakdown = {
      active: tickets.filter(t => t.status === 'active').reduce((sum, t) => sum + t.price, 0),
      used: tickets.filter(t => t.status === 'used').reduce((sum, t) => sum + t.price, 0),
      confirmed: tickets.filter(t => t.status === 'confirmed').reduce((sum, t) => sum + t.price, 0),
    };
    
    // Calculate organizer revenue after 3% Pazimo commission
    const pazimoCommission = totalRevenue * 0.03;
    const organizerRevenue = totalRevenue * 0.97;

    // Get pending and approved withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: 'pending'
    });

    const approvedWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: 'approved'
    });

    const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const approvedAmount = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Available balance = organizer revenue - (pending + approved withdrawals)
    const availableBalance = organizerRevenue - (pendingAmount + approvedAmount);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        totalRevenue,
        organizerRevenue,
        pazimoCommission,
        pendingWithdrawals: pendingAmount,
        approvedWithdrawals: approvedAmount,
        availableBalance,
        revenueBreakdown,
        statusBreakdown,
        summary: {
          totalEvents: events.length,
          totalTicketsSold: tickets.length,
          averageTicketPrice: tickets.length > 0 ? totalRevenue / tickets.length : 0
        }
      }
    });
  } catch (error) {
    console.error('Error getting organizer balance:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get organizer balance',
      error: error.message
    });
  }
};

// Create withdrawal request
const createWithdrawal = async (req, res) => {
  try {
    let organizerId;
    const { amount, notes, bankDetails } = req.body;

    if (req.user.role === 'admin') {
      organizerId = req.body.organizerId;
      if (!organizerId) {
        throw new BadRequestError('Organizer ID is required for admin withdrawal creation');
      }
    } else if (req.user.role === 'organizer') {
      organizerId = req.user.userId;
    } else {
      throw new UnauthorizedError('Only admins or organizers can create withdrawals');
    }

    // Get available balance (match the calculation in getOrganizerBalance)
    const events = await Event.find({ organizer: organizerId });
    const eventIds = events.map(event => event._id);
    const tickets = await Ticket.find({
      event: { $in: eventIds },
      status: { $nin: ["cancelled", "expired"] }
    });
    const totalRevenue = tickets.reduce((sum, ticket) => sum + ticket.price, 0);
    // Calculate organizer revenue after 3% Pazimo commission
    const organizerRevenue = totalRevenue * 0.97;
    
    const pendingWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: 'pending'
    });
    const approvedWithdrawals = await Withdrawal.find({
      organizer: organizerId,
      status: 'approved'
    });
    
    const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const approvedAmount = approvedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const availableBalance = organizerRevenue - (pendingAmount + approvedAmount);

    // Validate amount
    if (amount > availableBalance) {
      throw new BadRequestError('Withdrawal amount exceeds available balance');
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create({
      organizer: organizerId,
      amount,
      notes,
      bankDetails,
      processedBy: req.user.role === 'admin' ? req.user.userId : undefined,
      status: 'pending'
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: withdrawal
    });
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: error.message
    });
  }
};

// Update withdrawal status
const updateWithdrawalStatus = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, notes, transactionId } = req.body;

    console.log('Updating withdrawal status:', { withdrawalId, status, notes, transactionId });

    // Verify admin role
    if (req.user.role !== 'admin') {
      throw new UnauthorizedError('Only admins can update withdrawal status');
    }

    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundError('Withdrawal request not found');
    }

    console.log('Found withdrawal:', { 
      id: withdrawal._id, 
      organizer: withdrawal.organizer, 
      amount: withdrawal.amount,
      currentStatus: withdrawal.status,
      newStatus: status 
    });

    // Update withdrawal
    withdrawal.status = status;
    withdrawal.notes = notes || withdrawal.notes;
    withdrawal.transactionId = transactionId || withdrawal.transactionId;
    withdrawal.processedBy = req.user.userId;
    withdrawal.processedAt = new Date();

    await withdrawal.save();
    console.log('Withdrawal updated successfully');

    // Emit notification
    const notification = await Notification.create({
      userId: withdrawal.organizer,
      type: "withdrawal_status_change",
      message: `Your withdrawal of ${withdrawal.amount} Birr has been ${withdrawal.status}.`,
      withdrawalId: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      read: false,
    });
    console.log('Notification created:', notification._id);

    // Emit socket event to the organizer's room
    const io = req.app.get('io');
    if (io) {
      const roomName = `organizer_${withdrawal.organizer}`;
      console.log('Emitting to room:', roomName);
      io.to(roomName).emit('withdrawalStatusUpdated', {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      });
      console.log('Socket event emitted');
    } else {
      console.log('Socket.IO not available');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawal
    });
  } catch (error) {
    console.error('Error updating withdrawal status:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update withdrawal status',
      error: error.message
    });
  }
};

// Get all withdrawals (admin)
const getAllWithdrawals = async (req, res) => {
  try {
    const { status, organizerId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (organizerId) query.organizer = organizerId;

    // Get withdrawals with pagination
    const withdrawals = await Withdrawal.find(query)
      .populate('organizer', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Withdrawal.countDocuments(query);

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting withdrawals:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to get withdrawals',
      error: error.message
    });
  }
};

// Get organizer's withdrawals
const getOrganizerWithdrawals = async (req, res) => {
  try {
    let organizerId = req.params.organizerId;
    // Only allow admin to view any organizer, organizers can only view their own
    if (req.user.role === 'organizer') {
      organizerId = req.user.userId;
    }
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizer: organizerId };
    if (status && status !== 'all') query.status = status;

    // Get withdrawals with pagination
    const withdrawals = await Withdrawal.find(query)
      .populate('processedBy', 'firstName lastName email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Withdrawal.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      data: withdrawals,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting organizer withdrawals:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get organizer withdrawals',
      error: error.message
    });
  }
};

module.exports = {
  getOrganizerBalance,
  createWithdrawal,
  updateWithdrawalStatus,
  getAllWithdrawals,
  getOrganizerWithdrawals
}; 