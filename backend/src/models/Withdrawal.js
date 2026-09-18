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
    // Provider cut deducted from the requested amount (e.g. Telebirr's 2%
    // withdrawal fee). 0 for methods that don't charge one, like bank transfer.
    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // amount - feeAmount: what the organizer actually receives.
    netAmount: {
      type: Number,
    },
    transactionId: {
      type: String,
    },
    // Which pool this withdrawal draws from.
    //
    // Ticket and beverage revenue are separate balances with separate
    // withdrawal requests, so an organizer settles bar takings independently of
    // door takings. They share this one model and one approval flow on purpose:
    // a parallel BeverageWithdrawal would duplicate the balance check, the
    // audit trail and the admin queue, which is how beverage revenue became
    // invisible to money in the first place.
    //
    // "venue_beverages" is the venue channel's pool, added for the same reason
    // and settled through the same queue. It is a third pool, not a variant of
    // "beverages": that value means an ORGANIZER's drink takings from events,
    // and a venue must never draw against it.
    //
    // "cinema_tickets" and "cinema_beverages" are the cinema channel's two
    // pools. A cinema sells both seats and concessions and settles them
    // independently, exactly as an organizer settles door and bar money apart —
    // so selling out a screening does not let a cinema draw against popcorn it
    // has not sold.
    //
    // They are distinct values rather than reuses of "tickets"/"beverages"
    // because those two mean an ORGANIZER's event takings. A cinema must never
    // draw against them, and the balance check is scoped by this field.
    //
    // Every row that existed before this field is ticket revenue.
    stream: {
      type: String,
      enum: [
        "tickets",
        "beverages",
        "venue_beverages",
        "cinema_tickets",
        "cinema_beverages",
      ],
      default: "tickets",
      required: true,
    },

    // The venue being settled, on venue_beverages rows only.
    //
    // `organizer` above still carries the User account that requested the payout
    // (for a venue that is the account owning this venue), because it is what
    // the admin queue, the payout code and every existing index read. The field
    // name is historical — it is a User reference, not a claim that the payee
    // runs events. This field is what makes the venue itself identifiable, so
    // "how much has this venue been paid?" is answerable without joining back
    // through the account.
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
    },

    // The cinema being settled, on cinema_tickets and cinema_beverages rows.
    //
    // Same arrangement as `venue` above: `organizer` still carries the User
    // account that requested the payout (for a cinema, the account owning it),
    // because that is what the admin queue, the payout code and every existing
    // index read. This field makes the cinema itself identifiable, so "how much
    // has this cinema been paid?" is answerable without joining back through the
    // account — and it is what cinemaFinanceService scopes each pool by.
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
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
WithdrawalSchema.index({ organizer: 1, stream: 1, currency: 1, status: 1 });
WithdrawalSchema.index({ organizer: 1, currency: 1, status: 1 });
WithdrawalSchema.index({ organizer: 1, source: 1, status: 1 });
// The venue balance check sums this venue's pending + approved payouts.
WithdrawalSchema.index({ venue: 1, status: 1 });
// The cinema balance check sums one POOL's pending + approved payouts, so the
// stream is part of the key — the two cinema pools are summed separately.
WithdrawalSchema.index({ cinema: 1, stream: 1, status: 1 });
WithdrawalSchema.index({ createdAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

module.exports = Withdrawal; 