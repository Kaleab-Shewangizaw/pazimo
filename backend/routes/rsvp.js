const express = require('express');
const router = express.Router();
const Invitation = require('../src/models/Invitation');

// Confirm RSVP
router.post('/confirm', async (req, res) => {
  try {
    const { eventId, customerName, contact, guestType } = req.body;

    if (!eventId || !customerName || !contact) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Convert eventId to string if it's a number
    const eventIdStr = eventId.toString();
    const { status } = req.body;
    const rsvpStatus = status === 'declined' ? 'declined' : 'confirmed';

    let invitation = await Invitation.findOneAndUpdate(
      { eventId: eventIdStr, customerName, contact },
      { 
        rsvpStatus: rsvpStatus,
        rsvpConfirmedAt: new Date()
      },
      { new: true }
    );

    // If invitation not found, create a new one
    if (!invitation) {
      invitation = new Invitation({
        eventId: eventIdStr,
        customerName,
        contact,
        contactType: contact.includes('@') ? 'email' : 'phone',
        guestType: guestType || 'guest',
        qrCode: `guest-${eventIdStr}-${Date.now()}`,
        rsvpStatus: rsvpStatus,
        rsvpConfirmedAt: new Date(),
        organizerId: '000000000000000000000000' // Default organizer ID
      });
      await invitation.save();
    }

    res.json({
      success: true,
      message: 'RSVP confirmed successfully',
      data: invitation
    });

  } catch (error) {
    console.error('RSVP confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendees for an event
router.get('/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventIdStr = eventId.toString();
    console.log('Fetching attendees for event:', eventIdStr);

    // First check all invitations for this event
    const allInvitations = await Invitation.find({ eventId: eventIdStr });
    console.log('All invitations for event:', allInvitations.length);
    
    const attendees = await Invitation.find({
      eventId: eventIdStr,
      rsvpStatus: { $in: ['confirmed', 'declined'] }
    }).select('customerName contact contactType guestType rsvpConfirmedAt rsvpStatus');

    console.log('Found attendees with RSVP:', attendees.length);

    res.json({
      success: true,
      attendees: attendees.map(attendee => ({
        id: attendee._id,
        customerName: attendee.customerName,
        contact: attendee.contact,
        contactType: attendee.contactType,
        guestType: attendee.guestType,
        confirmedAt: attendee.rsvpConfirmedAt,
        status: attendee.rsvpStatus
      })),
      total: attendees.length
    });

  } catch (error) {
    console.error('Fetch attendees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;