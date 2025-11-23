const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const TicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      default: generateShortId,
      unique: true,
      required: true,
      index: true
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ticketType: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'cancelled', 'expired', 'pending'],
      default: 'active',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    paymentDate: {
      type: Date,
    },
    qrCode: {
      type: String,
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
    },
    seatNumber: {
      type: String,
    },
    paymentReference: {
      type: String,
      required: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// 🔐 Generate QR code before saving
TicketSchema.pre('save', async function (next) {
  if (!this.qrCode) {
    try {
      const qrPayload = {
        _id: this._id,
        ticketId: this.ticketId,
        eventId: this.event.toString(),
        userId: this.user.toString(),
        ticketType: this.ticketType,
        price: this.price,
        purchaseDate: this.purchaseDate.toISOString(),
        status: this.status,
        paymentReference: this.paymentReference || null,
      };
      
      // Generate QR code with better error correction and size
      this.qrCode = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        width: 256,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      next();
    } catch (error) {
      console.error('Error generating QR code:', error);
      next(error);
    }
  } else {
    next();
  }
});

const Ticket = mongoose.model('Ticket', TicketSchema);

module.exports = Ticket;
