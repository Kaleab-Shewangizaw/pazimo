const express = require('express');
const QRCode = require('qrcode');
const QRTicket = require('../models/QRTicket');
const Event = require('../models/Event');
const router = express.Router();

// Generate QR ticket after RSVP confirmation
router.post('/generate', async (req, res) => {
  try {
    const { eventId, customerName, contact, guestType, qrCount = 1 } = req.body;

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    // Check if tickets already exist
    const existingTickets = await QRTicket.find({ eventId, contact });
    if (existingTickets.length >= qrCount) {
      return res.json({ 
        success: true, 
        tickets: existingTickets,
        qrCodes: existingTickets.map(t => t.qrCode)
      });
    }

    const tickets = [];
    const qrCodes = [];
    const currentCount = await QRTicket.countDocuments({ eventId });

    // Generate multiple QR codes based on qrCount
    for (let i = 0; i < qrCount; i++) {
      const ticketNumber = `${event.title.substring(0, 3).toUpperCase()}-${String(currentCount + i + 1).padStart(4, '0')}`;
      
      const ticketData = {
        ticketNumber,
        eventId,
        eventTitle: event.title,
        customerName,
        contact,
        eventDate: event.startDate,
        eventTime: event.startTime,
        guestType,
        confirmedAt: new Date().toISOString(),
        ticketIndex: i + 1
      };

      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(ticketData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#0D47A1',
          light: '#FFFFFF'
        }
      });

      const ticket = new QRTicket({
        eventId,
        ticketNumber,
        customerName,
        contact,
        guestType,
        qrCode: qrCodeDataUrl
      });

      await ticket.save();
      tickets.push(ticket);
      qrCodes.push(qrCodeDataUrl);
    }

    res.json({
      success: true,
      tickets,
      qrCodes,
      count: qrCount
    });

  } catch (error) {
    console.error('QR ticket generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate ticket' });
  }
});

// Verify QR ticket
router.post('/verify', async (req, res) => {
  try {
    const { ticketNumber } = req.body;

    const ticket = await QRTicket.findOne({ ticketNumber }).populate('eventId');
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (ticket.status === 'used') {
      return res.json({ 
        success: false, 
        error: 'Ticket already used',
        usedAt: ticket.usedAt 
      });
    }

    // Mark ticket as used
    ticket.status = 'used';
    ticket.usedAt = new Date();
    await ticket.save();

    res.json({
      success: true,
      ticket,
      message: 'Ticket verified successfully'
    });

  } catch (error) {
    console.error('Ticket verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

module.exports = router;