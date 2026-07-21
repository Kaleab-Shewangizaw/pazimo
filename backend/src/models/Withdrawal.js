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
    },
    transactionId: {
      type: String,
    },
    // Which balance this draws down. Ticket-sale revenue and disbursed loan
    // principal are tracked as separate pools (see financeService.js) so a
    // loan payout never gets counted as ordinary ticket revenue or vice
    // versa. Missing/undefined is treated as 'ticket_revenue' throughout for
    // backward compatibility with withdrawals created before this field.
    source: {
      type: String,
      enum: ['ticket_revenue', 'loan'],
      default: 'ticket_revenue',
    },
    // Best-effort reference to the loan this withdrawal drew from, when
    // source is 'loan'. Not the source of truth for balance math (that's
    // the aggregation in financeService.calculateLoanBalance) — just lets
    // admins trace a specific withdrawal back to the loan that funded it.
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