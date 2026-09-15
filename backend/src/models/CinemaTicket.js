const mongoose = require("mongoose");
const {
  DEFAULT_COMMISSION_RATE,
  normalizeCommissionRate,
  organizerVatRateFor,
} = require("../config/rates");

// The ledger of cinema ticket sales — one row per seat sold for one screening.
// Source of truth for cinema ticket revenue; CinemaShowtime.ticketTypes[].sold
// is only a denormalised counter kept alongside it so seats can be claimed
// atomically.
//
// WHY THIS IS A SEPARATE COLLECTION FROM Ticket
//
// The two could have shared one collection behind a salesContext discriminator.
// They deliberately do not, for the reason VenueBeverageSale spells out on the
// concessions side: Ticket is read by aggregations that carry no ownership
// filter at all. utils/ticketRevenueQuery scopes by resolving an ORGANIZER's
// event ids, admin dashboards sum the collection outright, and the QR scanner
// matches on ticketId alone. In a shared collection every one of those call
// sites — and every future one — would have to remember to exclude cinema rows,
// or cinema money would silently land in an organizer's balance and be paid out
// to them.
//
// A separate collection makes that class of mistake impossible to write rather
// than merely forbidden. What is NOT duplicated is the money maths: both
// channels compute commission, VAT and the seller's share through the same
// rates in config/rates.js, applied by utils/cinemaTicketRevenueQuery.js exactly
// as ticketRevenueQuery.js applies them for events.
//
// Prices are snapshotted at the moment of sale for the same reason Ticket does
// it: a cinema repricing a screening must never restate what a past sale was
// worth.
function generateShortId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CinemaTicketSchema = new mongoose.Schema(
  {
    // The scannable identifier, in the same 8-character alphabet Ticket uses so
    // the existing QR renderer and scanner work unchanged. Uniqueness is
    // enforced per collection; the scanner is told which channel it is
    // validating, so the two id spaces never have to be searched together.
    ticketId: {
      type: String,
      default: generateShortId,
      unique: true,
      required: true,
      index: true,
    },

    // The sales context, stated explicitly rather than left implicit in the
    // collection name. Admin screens merge channels into one feed and every row
    // in that feed has to say which produced it. Constant by design: a row in
    // this collection is a cinema sale, always.
    salesContext: {
      type: String,
      enum: ["CINEMA"],
      default: "CINEMA",
    },

    // Denormalised from the showtime so ownership can be checked and a cinema's
    // tickets queried without a join. Always copied from the showtime, never
    // taken from client input.
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaShowtime",
      required: true,
    },
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaMovie",
      required: true,
    },
    hall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaHall",
    },

    // Snapshots of what was bought, so a ticket still reads correctly after the
    // film is retired, the hall renamed or the tier deleted.
    movieTitle: {
      type: String,
      required: true,
    },
    hallName: {
      type: String,
    },
    showtimeStartsAt: {
      type: Date,
      required: true,
    },
    // The tier's _id on the showtime, kept so a refund can return the seat to
    // the exact tier it came from even after the tier has been renamed.
    ticketTypeId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    ticketType: {
      type: String,
      required: true,
    },

    // The seats this ticket admits, on a hall with assigned seating. One
    // ticket covers every seat bought in the same price category in one
    // checkout (2 VIP seats in one order -> one ticket, seats.length === 2) —
    // a mixed-category order (2 VIP + 1 Standard) still produces two tickets,
    // one per category, matching how a mixed-ticket-type event order already
    // works. `quantity` below is always seats.length on an assigned hall.
    //
    // Each entry is a SNAPSHOT, not a reference. The hall's map is a living
    // document a cinema re-tiers and re-labels; a sold ticket must keep saying
    // "Row K, seat 7, VIP" for ever, even after row K is renamed or the VIP
    // box is moved. It is also what the door reads, and the door cannot depend
    // on the map still describing the room the way it did when the ticket was
    // bought.
    //
    // Empty on unassigned-seating halls and on box-office sales that predate a
    // hall's seat map, where a ticket admits to the room and not to a chair.
    seats: {
      type: [
        {
          _id: false,
          row: { type: String, trim: true },
          number: { type: String, trim: true },
          // "A-12" — the identity the hold used, kept so a refund can find and
          // release the exact row that was locked.
          seatKey: { type: String, trim: true },
          categoryKey: { type: String, trim: true },
          categoryLabel: { type: String, trim: true },
          // Set when THIS seat is admitted at the door, independent of the
          // others on the same ticket — a group of 4 sharing one ticket can
          // walk in as they arrive rather than all at once. The ticket-level
          // `checkedIn`/`status` below only flips once every seat here has
          // one of these, so the ticket stays scannable for whoever is left.
          // Absent entirely on an unassigned hall's ticket (seats is always
          // [] there), where admission has no per-chair identity to track.
          admittedAt: { type: Date, default: null },
        },
      ],
      default: [],
    },

    // The per-seat price of the tier at the moment of sale.
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // How many seats/admissions this ticket covers — seats.length on an
    // assigned hall, a plain counter on an unassigned one.
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    // price × quantity, written at sale time.
    //
    // Stored rather than multiplied on read, and named unambiguously, because
    // the event side learned this the hard way: Ticket.price is the row total
    // while ticketCount/purchaseQuantity carry admissions, so every revenue
    // reader has to know that summing price is right and summing price ×
    // quantity would double-count. Here the money field says which it is.
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
      index: true,
    },

    // The commission rate this ticket was sold under, copied from the cinema at
    // creation and never rewritten — same reasoning as Ticket.commissionRate.
    // An admin renegotiating a cinema's cut must not retroactively revalue
    // seats already sold, reported and in many cases paid out.
    commissionRate: {
      type: Number,
      min: 0,
    },

    // The cinema's own VAT withheld on this ticket, when Pazimo covers the
    // cinema (Cinema.coversCinemaVat). 0 or absent means the cinema settles its
    // own. A liability Pazimo remits on their behalf, never Pazimo revenue.
    cinemaVatRate: {
      type: Number,
      min: 0,
    },

    // Who bought it. Optional: a walk-in at the box office has no account.
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
    },

    // Mirrors Ticket's vocabulary so the two channels read alike on an admin
    // screen. "cancelled" and "refunded" stay in the ledger and are excluded
    // from revenue rather than being deleted — the history matters.
    status: {
      type: String,
      enum: ["active", "used", "cancelled", "refunded", "expired"],
      default: "active",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paymentDate: {
      type: Date,
    },
    paymentReference: {
      type: String,
      index: true,
      sparse: true,
    },

    // How the sale reached us. "box_office" is a cinema operator selling at the
    // counter; "online" is a customer checkout.
    channel: {
      type: String,
      enum: ["online", "box_office"],
      default: "box_office",
    },

    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedAt: {
      type: Date,
    },
    // Which account admitted the holder. A cinema validating its own screening,
    // so this is the cinema's User account rather than an Admin.
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    refundedAt: Date,
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    refundReason: String,

    // Set while a CinemaShare transfer of this ticket is outstanding (see
    // services/cinemaShareService.js) — locks it against check-in or a
    // second, overlapping transfer until the recipient accepts, declines, or
    // it expires. Mirrors Ticket.pendingShare exactly, same reasoning:
    // ownership of an admitting seat must never be ambiguous while a
    // hand-off is in flight.
    pendingShare: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaShare",
      default: null,
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Dashboards read by cinema, by showtime and by customer, newest-first, almost
// always filtered to tickets that count as revenue.
CinemaTicketSchema.index({ cinema: 1, purchaseDate: -1 });
CinemaTicketSchema.index({ showtime: 1, status: 1 });
CinemaTicketSchema.index({ movie: 1, purchaseDate: -1 });
CinemaTicketSchema.index({ customer: 1, purchaseDate: -1 });
// Revenue queries scope by cinema and exclude cancellations/refunds.
CinemaTicketSchema.index({ cinema: 1, status: 1, paymentStatus: 1, purchaseDate: -1 });
// The scanner looks a ticket up by its code and nothing else.
CinemaTicketSchema.index({ showtime: 1, checkedIn: 1 });
// "Which seat is this?" at the door, and the refund path's lookup by seat.
// Sparse: only assigned-seating tickets carry any, and indexing the nulls of
// every box-office sale would be pure cost.
CinemaTicketSchema.index({ showtime: 1, "seats.seatKey": 1 }, { sparse: true });

// Snapshot the cinema's ticket commission rate and VAT coverage at sale time.
//
// In the model rather than in the service, so no future sale path — a box-office
// screen, an online checkout, an import, a backfill — can forget it. Mirrors the
// identical hook on Ticket and on the two beverage ledgers.
CinemaTicketSchema.pre("validate", async function snapshotCommissionRate(next) {
  if (!this.isNew) return next();
  const hasCommission = typeof this.commissionRate === "number";
  const hasCinemaVat = typeof this.cinemaVatRate === "number";
  if (hasCommission && hasCinemaVat) return next();
  if (!this.cinema) return next();

  try {
    const CinemaModel = require("./Cinema");
    const cinema = await CinemaModel.findById(this.cinema)
      .select("ticketCommissionRate coversCinemaVat")
      .lean();
    if (!hasCommission) {
      this.commissionRate = normalizeCommissionRate(
        cinema?.ticketCommissionRate ?? DEFAULT_COMMISSION_RATE
      );
    }
    if (!hasCinemaVat) {
      this.cinemaVatRate = organizerVatRateFor(cinema?.coversCinemaVat);
    }
    next();
  } catch (error) {
    // A pricing lookup must never block a paid ticket from being issued. Fall
    // back to the same defaults a reader would have assumed.
    console.error(
      "Cinema commission snapshot failed, using default:",
      error.message
    );
    if (!hasCommission) this.commissionRate = DEFAULT_COMMISSION_RATE;
    // Not covering is the safe fallback: it leaves the money with the cinema
    // rather than withholding tax Pazimo may not owe.
    if (!hasCinemaVat) this.cinemaVatRate = 0;
    next();
  }
});

module.exports = mongoose.model("CinemaTicket", CinemaTicketSchema);
