const mongoose = require("mongoose");

// One seat, on one screening, spoken for.
//
// WHY A SEPARATE COLLECTION
//
// Seat selection has exactly one hard problem: two people clicking K7 at the
// same moment must not both get it, including across the minutes a payment
// takes to settle. Everything else is presentation.
//
// A `heldBy` field on a seat inside the hall's map cannot solve it — the map
// belongs to the hall, not the screening, so it has no room for "K7 is taken
// for the 19:30 but free for the 22:00". Putting holds on the showtime would
// mean every claim rewriting one hot document that the whole auditorium
// contends on.
//
// So: one row per held seat, with a UNIQUE INDEX on (showtime, seatKey). The
// claim is an insert. MongoDB's uniqueness guarantee IS the lock — the second
// inserter gets a duplicate-key error and is told the seat is gone. No read,
// no compare, no window between them.
//
// WHY THE SAME COLLECTION HOLDS SOLD SEATS
//
// A sold seat must block a new hold just as firmly as a held one. Keeping both
// here means that is the same unique index doing the same job, rather than a
// second check against CinemaTicket that could be forgotten by a future caller.
// `status` says which it is, and `expiresAt` says whether it ever lapses.
//
// EXPIRY
//
// `expiresAt` carries a TTL index, so an abandoned checkout releases its seats
// with no sweeper process to run or forget to run. Sold rows set it to null,
// which MongoDB's TTL ignores — so a paid seat is never reaped. That asymmetry
// is the whole lifecycle: held rows are temporary by default and become
// permanent by being paid for.
const CinemaSeatHoldSchema = new mongoose.Schema(
  {
    showtime: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaShowtime",
      required: true,
    },
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },

    // "A-12". The identity the hall map, the picker and the ticket all agree
    // on — built by CinemaHall.sellableSeats() so nothing invents its own
    // spelling.
    seatKey: {
      type: String,
      required: true,
      trim: true,
    },
    row: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    // Snapshotted from the hall map at hold time. A cinema re-tiering its room
    // mid-checkout must not change what this seat costs the person holding it.
    categoryKey: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["held", "sold"],
      default: "held",
      required: true,
    },

    // Null on a sold seat, so the TTL index skips it. See the note above.
    expiresAt: {
      type: Date,
      default: null,
    },

    // Ties a group of seats to one checkout, so all of them can be released
    // together if payment fails and confirmed together when it succeeds.
    reference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Set when the hold becomes a sale, so a refund can find the row to release.
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CinemaTicket",
    },
  },
  { timestamps: true }
);

// THE LOCK. Two concurrent claims on the same seat of the same screening: one
// insert succeeds, the other gets E11000 and is told the seat is taken.
CinemaSeatHoldSchema.index({ showtime: 1, seatKey: 1 }, { unique: true });

// The picker asks "what is taken for this screening" on every render.
CinemaSeatHoldSchema.index({ showtime: 1, status: 1 });

// Automatic release. expireAfterSeconds: 0 means "delete when the date in this
// field passes"; documents whose expiresAt is null are never considered, which
// is exactly how sold seats survive.
CinemaSeatHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("CinemaSeatHold", CinemaSeatHoldSchema);
