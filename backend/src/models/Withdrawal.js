const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['ETB', 'USD'],
      default: 'ETB',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      accountHolderName: String,
    },
    transactionId: {
      type: String,
    },
    // Legacy field. Borrowed Pazimo Capital principal is now credited into the
    // single ticket-revenue balance (see financeService.calculateOrganizerBalance),
    // so every withdrawal draws that one pool regardless of source. Kept only so
    // older 'loan'-sourced rows still validate; new rows default to
    // 'ticket_revenue' and the value no longer affects balance math.
    source: {
      type: String,
      enum: ['ticket_revenue', 'loan'],
      default: 'ticket_revenue',
    },
    // Optional back-reference to a loan, retained for tracing older rows.
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
    },
  },
  {
    timestamps: true,
  }
);

// Add index for faster queries
WithdrawalSchema.index({ organizer: 1, status: 1 });
WithdrawalSchema.index({ organizer: 1, currency: 1, status: 1 });
WithdrawalSchema.index({ organizer: 1, source: 1, status: 1 });
WithdrawalSchema.index({ createdAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

module.exports = Withdrawal; 