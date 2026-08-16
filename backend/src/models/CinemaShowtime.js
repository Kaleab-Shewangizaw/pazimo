const mongoose = require("mongoose");

// One screening: this film, in this hall, at this time — and the prices it sells
// at. The cinema channel's unit of sale.
//
// Ticket types live HERE and not on CinemaMovie on purpose. A Tuesday matinee
// and a Saturday premiere of the same film are different prices, so pricing
// attached to the film would have to be overridden per showing anyway. It is the
// same rule the platform already follows for concessions: the catalogue entry
// (Beverage, CinemaMovie) is priceless, and the sales context
// (CinemaBeverage, CinemaShowtime) carries the price.
const CinemaTicketTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
    },
    // Seats allocated to this tier for this screening. The sum across tiers is
    // validated against the hall's capacity when the showtime is saved.
    allocation: {
      type: Number,
      required: true,
      min: 0,
    },
    // Sold so far. Denormalised from the CinemaTicket ledger, which stays the
    // source of truth for money and history.
    //
    // This counter exists so "is there a seat left?" can be answered and
    // decremented in a SINGLE atomic update. Counting the ledger and then
    // writing would let two concurrent buyers claim the same last seat — the
    // identical discipline EventBeverage.sold follows for stock.
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Lets a cinema close one tier (say, Student) without closing the screening.
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const CinemaShowtimeSchema = new mongoose.Schema(
  {
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
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
      required: true,
    },

    startsAt: {
      type: Date,
      required: [true, "Showtime start is required"],
    },
    // Derived from startsAt + CinemaMovie.durationMinutes at save time. Stored
    // rather than computed on read so overlap detection is an indexed range
    // query instead of a scan that has to join every showing to its film.
    endsAt: {
      type: Date,
    },

    ticketTypes: {
      type: [CinemaTicketTypeSchema],
      validate: {
        validator: (types) => Array.isArray(types) && types.length > 0,
        message: "A showtime needs at least one ticket type",
      },
    },

    currency: {
      type: String,
      enum: ["ETB"],
      default: "ETB",
    },

    // "scheduled" sells; "cancelled" stops sales but keeps the row and its
    // tickets, which have to survive for refund and audit; "completed" is set by
    // the scheduler once the screening has ended.
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "completed"],
      default: "scheduled",
    },

    // Hidden showings still exist and still honour tickets already sold; they
    // simply do not appear in the public listing. Lets a cinema stage a schedule
    // before announcing it.
    isPublished: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// The public listing reads "what is on at this cinema from now on", and the
// scheduling screen reads one hall's day. Both are covered here.
CinemaShowtimeSchema.index({ cinema: 1, startsAt: 1 });
CinemaShowtimeSchema.index({ cinema: 1, status: 1, isPublished: 1, startsAt: 1 });
CinemaShowtimeSchema.index({ movie: 1, startsAt: 1 });
// Overlap detection scans one hall's window.
CinemaShowtimeSchema.index({ hall: 1, startsAt: 1, endsAt: 1 });

// Keep endsAt in step with the start time and the film's runtime.
//
// In the model rather than the controller so that every write path — the
// scheduling form, a bulk "schedule a week of showings" tool, an import —
// produces a row overlap detection can actually read.
CinemaShowtimeSchema.pre("validate", async function deriveEndsAt(next) {
  if (!this.startsAt || !this.movie) return next();
  if (!this.isNew && !this.isModified("startsAt") && !this.isModified("movie")) {
    return next();
  }

  try {
    // Required lazily to avoid a require cycle through the model registry.
    const CinemaMovie = require("./CinemaMovie");
    const movie = await CinemaMovie.findById(this.movie)
      .select("durationMinutes")
      .lean();
    const minutes = Number(movie?.durationMinutes);
    // Unknown runtime means no derivable end. Left null rather than guessed:
    // overlap detection treats a null end as "cannot tell" and warns instead of
    // silently approving a clash it never checked.
    this.endsAt = Number.isFinite(minutes) && minutes > 0
      ? new Date(this.startsAt.getTime() + minutes * 60000)
      : null;
    next();
  } catch (error) {
    // A runtime lookup must never block a schedule from being saved.
    console.error("Showtime endsAt derivation failed:", error.message);
    this.endsAt = null;
    next();
  }
});

module.exports = mongoose.model("CinemaShowtime", CinemaShowtimeSchema);
