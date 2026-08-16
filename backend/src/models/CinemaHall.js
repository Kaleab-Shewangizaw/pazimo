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

module.exports = mongoose.model("CinemaHall", CinemaHallSchema);
