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

    // --- Assigned seating -------------------------------------------------
    //
    // While this is false the hall sells by capacity alone and nothing below is
    // read, exactly as every existing hall does today. Turning it on requires a
    // seat map, enforced in the validator.
    hasAssignedSeating: {
      type: Boolean,
      default: false,
    },

    // The seat categories this room offers, and what they are called.
    //
    // Defined per HALL rather than per showtime because they describe the room:
    // the back two rows are the VIP box whatever is playing. A showtime then
    // attaches a PRICE to each category (CinemaShowtime.ticketTypes carries
    // seatCategoryKey), so picking seat K7 charges the VIP price without the
    // customer choosing a tier separately and without staff having to police
    // who sat where.
    //
    // `key` is the stable identifier tickets and prices reference. `label` is
    // display text a cinema can rename freely — renaming "VIP" to "Premium"
    // must not revalue seats already sold or orphan a showtime's pricing.
    seatCategories: {
      type: [
        {
          key: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
          },
          label: { type: String, required: true, trim: true },
          // Editor and picker colour. Presentation only.
          color: { type: String, trim: true, default: "#6366f1" },
          _id: false,
        },
      ],
      default: undefined,
    },

    // The room, row by row.
    //
    // A grid with per-seat editing rather than free-form coordinates: rows and
    // seat numbers are what a customer reads off a ticket and what staff call
    // out at the door, so the model keeps them first-class instead of deriving
    // them from positions. Anything a real auditorium does that a plain grid
    // cannot — aisles, staggered rows, a curved sweep, a short back row — is
    // expressed by removing seats and offsetting rows, which keeps every seat
    // addressable as "row + number".
    seatMap: {
      rows: {
        type: [
          {
            // "A", "B", … Stored, not generated, so a room that skips "I"
            // (easily misread as "1") stays correct.
            label: { type: String, required: true, trim: true },

            // How far this row bows toward the screen, in arbitrary units the
            // renderer scales. 0 is a straight row. Purely presentational: it
            // changes where a seat is DRAWN, never which seat it is, so a
            // cinema can restyle the curve without touching a sold ticket.
            curve: { type: Number, default: 0, min: -100, max: 100 },

            // Horizontal nudge, same units. Lets a short row sit centred rather
            // than left-aligned against the rows around it.
            offset: { type: Number, default: 0, min: -100, max: 100 },

            seats: {
              type: [
                {
                  // "1", "12", or "A1" — free text because numbering conventions
                  // differ and a wrong assumption makes a hall undescribable.
                  number: { type: String, required: true, trim: true },
                  categoryKey: { type: String, required: true, trim: true, lowercase: true },
                  // false is a GAP, not a deleted seat: an aisle, a pillar, a
                  // wheelchair space. Kept in the array so the seats around it
                  // hold their positions when the map is redrawn.
                  exists: { type: Boolean, default: true },
                  // Sold to no one, ever — a house seat, a broken chair, a
                  // sightline block. Rendered but never sellable, which is
                  // different from not existing.
                  blocked: { type: Boolean, default: false },
                  _id: false,
                },
              ],
              default: [],
            },
            _id: false,
          },
        ],
        default: undefined,
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

/**
 * Every sellable seat in the room, flattened.
 *
 * A seat is sellable when it exists and is not blocked. Both flags are needed:
 * a gap is a place where there is no chair, a blocked seat is a chair nobody may
 * buy, and conflating them would make a house seat vanish from the picker
 * instead of showing as unavailable.
 */
CinemaHallSchema.methods.sellableSeats = function sellableSeats() {
  const rows = this.seatMap?.rows || [];
  const out = [];
  for (const row of rows) {
    for (const seat of row.seats || []) {
      if (seat.exists && !seat.blocked) {
        out.push({
          row: row.label,
          number: seat.number,
          categoryKey: seat.categoryKey,
          // The identity a hold, a ticket and the picker all agree on. Built in
          // one place so no caller invents its own spelling of "A-12".
          seatKey: `${row.label}-${seat.number}`,
        });
      }
    }
  }
  return out;
};

/** How many sellable seats each category has. Drives showtime allocation. */
CinemaHallSchema.methods.seatCountsByCategory = function seatCountsByCategory() {
  const counts = new Map();
  for (const seat of this.sellableSeats()) {
    counts.set(seat.categoryKey, (counts.get(seat.categoryKey) || 0) + 1);
  }
  return counts;
};

// The map, the categories and the capacity have to agree.
//
// Reported via invalidate() rather than next(new Error(...)): that produces a
// real Mongoose ValidationError, which the controllers map to a 400. Passing a
// plain Error propagates it untouched and surfaces as a 500 — bad input
// reported as a server fault, with the explanation swallowed.
CinemaHallSchema.pre("validate", function checkSeatMap(next) {
  const rows = this.seatMap?.rows || [];
  const categories = this.seatCategories || [];

  if (!rows.length) {
    if (this.hasAssignedSeating) {
      this.invalidate(
        "seatMap",
        "A hall with assigned seating needs a seat map. Add at least one row."
      );
    }
    // No map and not selling by seat: the hall sells on capacity alone, exactly
    // as every hall did before seat maps existed. Nothing further to check.
    return next();
  }

  if (!categories.length) {
    this.invalidate(
      "seatCategories",
      "A seat map needs at least one seat category for its seats to belong to"
    );
    return next();
  }

  const known = new Set(categories.map((c) => c.key));
  if (known.size !== categories.length) {
    this.invalidate("seatCategories", "Seat category keys must be unique");
  }

  // A row label must be unique, because "row + number" IS a seat's identity —
  // two rows called "A" would make A-5 ambiguous, and a hold on one would block
  // the other.
  const rowLabels = new Set();
  const seenSeatKeys = new Set();

  for (const row of rows) {
    if (rowLabels.has(row.label)) {
      this.invalidate("seatMap", `Two rows are both labelled "${row.label}"`);
    }
    rowLabels.add(row.label);

    for (const seat of row.seats || []) {
      const seatKey = `${row.label}-${seat.number}`;
      if (seenSeatKeys.has(seatKey)) {
        this.invalidate("seatMap", `Seat ${seatKey} appears twice`);
      }
      seenSeatKeys.add(seatKey);

      // Checked even for gaps: a gap that later becomes a seat would otherwise
      // carry a category nothing recognises, and the failure would surface at
      // sale time rather than at edit time.
      if (!known.has(seat.categoryKey)) {
        this.invalidate(
          "seatMap",
          `Seat ${seatKey} is in category "${seat.categoryKey}", which this hall does not define`
        );
      }
    }
  }

  // Capacity follows the map rather than being checked against it.
  //
  // Two numbers that must agree are one number too many: an operator who
  // removes a row for an aisle should not then have to remember to retype the
  // capacity, and a mismatch would either oversell the room or silently strand
  // seats. The map is the more specific statement, so it wins — and capacity
  // stays a real field because halls WITHOUT a map still sell on it.
  const sellable = this.sellableSeats().length;
  if (sellable === 0) {
    this.invalidate("seatMap", "The seat map has no sellable seats");
    return next();
  }
  this.capacity = sellable;

  next();
});

module.exports = mongoose.model("CinemaHall", CinemaHallSchema);
