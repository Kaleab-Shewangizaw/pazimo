const mongoose = require("mongoose");

// A film in one cinema's listing.
//
// Deliberately scoped to a cinema rather than being a global film catalogue.
// Two cinemas showing the same title keep their own rows, because everything a
// cinema actually edits here — the poster it uses, the synopsis it writes, the
// certificate it displays — is that cinema's own presentation of the film. A
// shared catalogue would mean one cinema's poster change rewriting another's
// listing, and would need an admin gatekeeper before any cinema could schedule
// a new release.
//
// This is NOT an Event. It carries no commission rate, no organizer, and never
// appears in the public events listing. Pricing lives on the showtime, not here:
// a Tuesday matinee and a Saturday night showing of the same film are different
// prices, so a price on the film itself would have to be overridden everywhere.
const CinemaMovieSchema = new mongoose.Schema(
  {
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Movie title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Relative path like "/uploads/1746842922821.PNG", matching every other
    // image field on the platform — the API serves /uploads statically.
    poster: {
      type: String,
      default: null,
    },
    // Runtime in minutes. Used to warn a cinema when two showings in the same
    // hall would overlap; see cinemaShowtimeService.
    durationMinutes: {
      type: Number,
      min: 1,
    },
    genre: {
      type: [String],
      default: [],
    },
    language: {
      type: String,
      trim: true,
    },
    subtitles: {
      type: String,
      trim: true,
    },
    // Certificate, as free text rather than an enum: rating systems differ by
    // country and change, and a wrong enum would block a cinema from listing a
    // film at all.
    ageRating: {
      type: String,
      trim: true,
    },
    // Retiring a film hides it from the scheduling picker without deleting it,
    // which has to survive for the showtimes already scheduled against it.
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// A title appears once per cinema. Case-insensitive for the same reason
// Beverage and Venue are: "Dune" and "dune" would look like duplicates in the
// scheduling picker.
CinemaMovieSchema.index(
  { cinema: 1, title: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
CinemaMovieSchema.index({ cinema: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model("CinemaMovie", CinemaMovieSchema);
