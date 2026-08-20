const express = require('express');
const QRCode = require('qrcode');
const QRTicket = require('../models/QRTicket');
const Event = require('../models/Event');
const { authenticateUser, restrictTo } = require('../middlewares/auth');
const { qrIssueLimiter, adminWriteLimiter } = require('../middlewares/rateLimiters');
const router = express.Router();

// ============================================================================
// /api/qr-tickets — a second, older QR ticketing path, parallel to the real one
// in ticketController (Ticket + validateQRCode). Nothing in this repo's
// frontend calls it and QRTicket is referenced by no other module, so it is
// almost certainly dead. It is kept mounted rather than deleted only because an
// unseen client (the mobile app) might still use it; see PAZIMO_PLAN P0.
//
// SECURED 2026-08-20. Both routes below previously accepted anonymous requests:
// /generate minted admission QR codes from a raw eventId and qrCount, and
// /verify burned any ticket whose number a caller could guess. Both now require
// a credential, and /generate additionally checks that the caller actually owns
// the event — role alone is not enough, or one organizer could mint tickets
// against another organizer's event.
// ============================================================================

const staffOnly = [authenticateUser, restrictTo('admin', 'organizer')];

// True when this account may issue or burn tickets for this event: the
// organizer who owns it, or an admin. Mirrors the ownership rule the main
// ticket path already enforces — the event says who it belongs to, the request
// never does.
const mayActOnEvent = (event, user) =>
  user.role === 'admin' || String(event.organizer) === String(user.userId);

// Generate QR ticket after RSVP confirmation
router.post('/generate', qrIssueLimiter, ...staffOnly, async (req, res) => {
  try {
    const { eventId, customerName, contact, guestType, qrCount = 1 } = req.body;

    // Bounded because this loop does `qrCount` QR renders and `qrCount` writes
    // per request; an unbounded number here is a self-inflicted outage.
    const requested = Number(qrCount);
    if (!Number.isInteger(requested) || requested < 1 || requested > 100) {
      return res.status(400).json({
        success: false,
        error: 'qrCount must be a whole number between 1 and 100',
      });
    }

    // Get event details
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }

    if (!mayActOnEvent(event, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to issue tickets for this event',
      });
    }

    // Check if tickets already exist
    const existingTickets = await QRTicket.find({ eventId, contact });
    if (existingTickets.length >= requested) {
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
    for (let i = 0; i < requested; i++) {
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
      count: requested
    });

  } catch (error) {
    console.error('QR ticket generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate ticket' });
  }
});

// Verify QR ticket — and burn it. This is a write, not a read: it flips the
// ticket to `used`, so an anonymous caller could previously invalidate any
// ticket whose number they could guess, and the numbers are sequential
// (`ABC-0001`). Staff only.
router.post('/verify', adminWriteLimiter, ...staffOnly, async (req, res) => {
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