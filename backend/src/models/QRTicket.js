const mongoose = require('mongoose');

const qrTicketSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  ticketNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  guestType: {
    type: String,
    enum: ['guest', 'paid'],
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'used', 'cancelled'],
    default: 'confirmed'
  },
  qrCode: {
    type: String,
    required: true
  },
  confirmedAt: {
    type: Date,
    default: Date.now
  },
  usedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('QRTicket', qrTicketSchema);