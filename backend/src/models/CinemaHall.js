const mongoose = require("mongoose");

// A screen/auditorium inside one cinema.
//
// Capacity lives here rather than on the showtime because it is a property of
// the room, not of what is playing in it. A showtime's sellable allocation is
// derived from it (see CinemaShowtime.ticketTypes) and snapshotted there, so
// re-measuring a hall later never changes how many seats a past screening sold.
const CinemaHallSchema = new mongoose.Schema(
  {
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Hall name is required"],
      trim: true,
    },
    // Total seats in the room. The showtime allocation is validated against
    // this so a cinema cannot accidentally sell 400 seats in a 200-seat hall.
    capacity: {
      type: Number,
      required: [true, "Hall capacity is required"],
      min: 1,
    },
    // Free-text: "3D", "IMAX", "Standard". Descriptive only — it does not
    // affect pricing, which lives entirely on the showtime's ticket types.
    screenType: {
      type: String,
      trim: true,
    },

    // Minutes needed between screenings to empty, clean and re-seat the room.
    //
    // Null means "use the cinema's default" (Cinema.turnaroundMinutes) rather
    // than zero — an explicit 0 is a real answer ("no gap needed in this hall")
    // and must be distinguishable from "not set". Overlap detection adds this to
    // a screening's end before deciding the room is free.
    turnaroundMinutes: {
      type: Number,
      min: 0,
      default: null,
    },

    // --- Assigned seating (Phase 2) -------------------------------------
    //
    // Deliberately scaffolding only. Seat SELECTION is not implemented here and
    // must not be: it needs held seats with expiry, an atomic claim, and a
    // picker, which is its own phase.
    //
    // What this does is make that phase additive rather than a redesign. While
    // hasAssignedSeating is false the hall sells by capacity exactly as it does
    // today and nothing below is read. When it flips true, `seatLayout` already
    // describes the room's shape, and the per-seat map hangs off it — no change
    // to Cinema, CinemaShowtime or CinemaTicket is needed to get there.
    hasAssignedSeating: {
      type: Boolean,
      default: false,
    },
    seatLayout: {
      // Grid description. Enough to render and label a room without yet
      // committing to how an individual seat is identified or held.
      rows: {
        type: Number,
        min: 1,
      },
      seatsPerRow: {
        type: Number,
        min: 1,
      },
      // Row labels, e.g. ["A","B","C"]. Empty means generate them A, B, C…
      // Stored rather than derived so a room that skips "I" stays correct.
      rowLabels: {
        type: [String],
        default: [],
      },
    },
    // Retiring a hall stops it being scheduled without deleting it, which has
    // to survive for the screenings already recorded against it.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A hall name is unique within its cinema, not globally — "Screen 1" exists at
// every cinema in the country. Enforced in the database rather than by a
// read-then-write check, which would race under two open tabs.
CinemaHallSchema.index(
  { cinema: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
CinemaHallSchema.index({ cinema: 1, isActive: 1 });

// A described grid must agree with the stated capacity.
//
// Capacity stays the source of truth for selling while hasAssignedSeating is
// false, so letting a 10x12 grid sit on a hall of capacity 200 would quietly
// oversell the room the moment assigned seating is switched on.
// Reported via invalidate() rather than next(new Error(...)): that produces a
// real Mongoose ValidationError, which the controllers map to a 400. Passing a
// plain Error propagates it untouched and surfaces as a 500 — bad input
// reported as a server fault, with the explanation swallowed.
CinemaHallSchema.pre("validate", function checkSeatLayout(next) {
  const { rows, seatsPerRow } = this.seatLayout || {};

  if (!rows || !seatsPerRow) {
    if (this.hasAssignedSeating) {
      this.invalidate(
        "seatLayout",
        "A hall with assigned seating needs rows and seatsPerRow"
      );
    }
    return next();
  }

  const seats = rows * seatsPerRow;
  if (seats < this.capacity) {
    this.invalidate(
      "seatLayout",
      `Seat layout describes ${seats} seats but the hall capacity is ${this.capacity}`
    );
  }
  next();
});

module.exports = mongoose.model("CinemaHall", CinemaHallSchema);
