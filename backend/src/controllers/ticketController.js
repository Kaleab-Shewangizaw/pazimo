const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');



// Admin: Get all tickets with totals
// const getAllTicketsAdmin = async (req, res) => {
//   // Optional: ensure user has admin role
//   if (req.user.role !== 'admin') {
//     return res.status(StatusCodes.FORBIDDEN).json({ msg: 'Not authorized' });
//   }

//   const tickets = await Ticket.find()
//     .populate('event', 'title organizer startDate endDate')
//     .populate('user', 'name email');

//   const totalSold = tickets.length;
//   const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0);

//   res.status(StatusCodes.OK).json({
//     tickets,
//     totalSold,
//     totalRevenue,
//   });
// };
const getAllTicketsAdmin = async (req, res) => {
  try {
    // ✅ Optional: Enforce admin-only access
    if (req.user?.role !== 'admin') {
      return res.status(StatusCodes.FORBIDDEN).json({ message: 'Access denied: Admins only' })
    }

    // ✅ Fetch tickets with event & user data
    const tickets = await Ticket.find()
      .populate({
        path: 'event',
        select: 'title startDate endDate location organizer',
        populate: {
          path: 'organizer',
          select: 'name email',
        },
      })
      .populate('user', 'firstName lastName email')
      .lean()

    // Format the tickets data
    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      event: ticket.event ? {
        title: ticket.event.title,
        organizer: ticket.event.organizer ? {
          name: ticket.event.organizer.name
        } : null
      } : null,
      user: ticket.user ? {
        name: `${ticket.user.firstName} ${ticket.user.lastName}`
      } : null
    }))

    // ✅ Calculate total sold and revenue
    const totalSold = tickets.length
    const totalRevenue = tickets.reduce((sum, t) => sum + (t.price || 0), 0)

    res.status(StatusCodes.OK).json({
      success: true,
      data: formattedTickets,
      totalSold,
      totalRevenue,
    })
  } catch (error) {
    console.error('Admin ticket fetch error:', error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message,
    })
  }
}

// Create a new ticket
const createTicket = async (req, res) => {
  const { eventId, ticketType, seatNumber, userId } = req.body;
  

  // Find the event and verify ticket type
  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Find the ticket type in the event
  const ticketTypeInfo = event.ticketTypes.find(type => type.name === ticketType);
  if (!ticketTypeInfo) {
    throw new BadRequestError('Invalid ticket type');
  }

  // Check if ticket is available
  if (!ticketTypeInfo.available || ticketTypeInfo.quantity <= 0) {
    throw new BadRequestError('Ticket type is not available');
  }

  // Create the ticket
  const ticket = await Ticket.create({
    event: eventId,
    user: userId,
    ticketType,
    price: ticketTypeInfo.price,
    seatNumber,
  });

  // Update event ticket quantity
  ticketTypeInfo.quantity -= 1;
  await event.save();

  res.status(StatusCodes.CREATED).json({ ticket });
};

// Get user's tickets
const getUserTickets = async (req, res) => {
  const tickets = await Ticket.find({ user: req.user.userId })
    .populate('event', 'title startDate endDate location')
    .sort('-createdAt');

  res.status(StatusCodes.OK).json({ tickets, count: tickets.length });
};

// Get event tickets (works with or without authentication)
const getEventTickets = async (req, res) => {
  try {
    const { eventId } = req.params;

    // If authentication is present, verify organizer access
    if (req.user && req.user.userId && req.user.userId !== 'bypass') {
      const event = await Event.findOne({ _id: eventId, organizer: req.user.userId });
      if (!event) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
          success: false,
          message: 'Not authorized to view these tickets'
        });
      }
    }

    const tickets = await Ticket.find({ event: eventId })
      .populate('user', 'firstName lastName email')
      .sort('-createdAt');

    res.status(StatusCodes.OK).json({ tickets, count: tickets.length });
  } catch (error) {
    console.error('Get event tickets error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch event tickets',
      error: error.message
    });
  }
};

// Check in a ticket
const checkInTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify the user is the event organizer
    const event = await Event.findOne({ _id: ticket.event, organizer: req.user.userId });
    if (!event) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: 'Not authorized to check in this ticket'
      });
    }

    if (ticket.checkedIn) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: 'Ticket already checked in',
        data: {
          ticket,
          checkedInAt: ticket.checkedInAt
        }
      });
    }

    ticket.checkedIn = true;
    ticket.checkedInAt = new Date();
    ticket.status = 'used';
    await ticket.save();

    res.status(StatusCodes.OK).json({ 
      success: true,
      message: 'Ticket checked in successfully',
      ticket 
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to check in ticket',
      error: error.message
    });
  }
};

// Cancel a ticket
const cancelTicket = async (req, res) => {
  const { ticketId } = req.params;

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Verify the user owns the ticket
  if (ticket.user.toString() !== req.user.userId) {
    throw new UnauthorizedError('Not authorized to cancel this ticket');
  }

  if (ticket.status !== 'active') {
    throw new BadRequestError('Ticket cannot be cancelled');
  }

  ticket.status = 'cancelled';
  await ticket.save();

  // Update event ticket quantity
  const event = await Event.findById(ticket.event);
  const ticketType = event.ticketTypes.find(type => type.name === ticket.ticketType);
  if (ticketType) {
    ticketType.quantity += 1;
    await event.save();
  }

  res.status(StatusCodes.OK).json({ ticket });
};

// Get ticket by ID
const getTicket = async (req, res) => {
  const { ticketId } = req.params;

  const ticket = await Ticket.findById(ticketId)
    .populate('event', 'title startDate endDate location organizer')
    .populate('user', 'firstName lastName email');

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Verify the user owns the ticket or is the event organizer
  const event = await Event.findById(ticket.event);
  if (!event) {
    throw new NotFoundError('Event not found');
  }

  // Check if user and organizer IDs exist before comparing
  const userId = ticket.user?._id?.toString();
  const organizerId = event.organizer?.toString();
  const requestUserId = req.user?.userId;

  if (!userId || !organizerId || !requestUserId) {
    throw new UnauthorizedError('Invalid ticket or user data');
  }

  if (userId !== requestUserId && organizerId !== requestUserId) {
    throw new UnauthorizedError('Not authorized to view this ticket');
  }

  res.status(StatusCodes.OK).json({ ticket });
};

// Validate QR code and get ticket information
const validateQRCode = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    if (!qrData) {
      throw new BadRequestError('QR code data is required');
    }

    // Parse the QR code data
    let ticketData;
    try {
      ticketData = JSON.parse(qrData);
    } catch (error) {
      throw new BadRequestError('Invalid QR code format');
    }

    // Find the ticket using ticketId
    const ticket = await Ticket.findOne({ ticketId: ticketData.ticketId })
      .populate('event', 'title startDate endDate location organizer')
      .populate('user', 'firstName lastName email');

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Verify the ticket data matches
    if (ticket.event._id.toString() !== ticketData.eventId ||
        ticket.user._id.toString() !== ticketData.userId ||
        ticket.ticketType !== ticketData.ticketType) {
      throw new BadRequestError('Invalid ticket data');
    }

    // Check if ticket is still valid
    if (ticket.status !== 'active') {
      throw new BadRequestError(`Ticket is ${ticket.status}`);
    }

    // Check if ticket is already checked in
    if (ticket.checkedIn) {
      return res.status(StatusCodes.OK).json({
        success: true,
        alreadyCheckedIn: true,
        message: 'Ticket already checked in',
        data: {
          ticketId: ticket.ticketId,
          eventTitle: ticket.event.title,
          eventDate: ticket.event.startDate,
          eventLocation: ticket.event.location,
          ticketType: ticket.ticketType,
          price: ticket.price,
          userName: `${ticket.user.firstName} ${ticket.user.lastName}`,
          userEmail: ticket.user.email,
          purchaseDate: ticket.purchaseDate,
          status: ticket.status,
          checkedIn: ticket.checkedIn,
          checkedInAt: ticket.checkedInAt
        }
      });
    }

    // Return ticket information for validation
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ticketId: ticket.ticketId,
        eventTitle: ticket.event.title,
        eventDate: ticket.event.startDate,
        eventLocation: ticket.event.location,
        ticketType: ticket.ticketType,
        price: ticket.price,
        userName: `${ticket.user.firstName} ${ticket.user.lastName}`,
        userEmail: ticket.user.email,
        purchaseDate: ticket.purchaseDate,
        status: ticket.status,
        checkedIn: ticket.checkedIn
      }
    });

  } catch (error) {
    console.error('QR code validation error:', error);
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: error.message || 'Failed to validate QR code'
    });
  }
};

module.exports = {
  createTicket,
  getUserTickets,
  getEventTickets,
  checkInTicket,
  cancelTicket,
  getTicket,
  getAllTicketsAdmin,
  validateQRCode,
}; 