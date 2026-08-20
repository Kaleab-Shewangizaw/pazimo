const mongoose = require("mongoose");
const { generateShortId, slugify } = require("../utils/eventUrl");

// Reused from the event side rather than reimplemented: the platform already
// has one definition of what a URL slug looks like, and two would drift.
const createUniqueShortId = async (Model) => {
  while (true) {
    const shortId = await generateShortId();
    const existing = await Model.exists({ shortId });
    if (!existing) return shortId;
  }
};

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

    // The public URL is /cinema/{slug}-{shortId}, mirroring /events/{slug}-{shortId}.
    //
    // The shortId is what makes the URL unique, and it is why the slug itself
    // does not have to be. Two cinemas can both show "Dune" and both get a
    // readable URL — dune-a7f2 and dune-3k9x — with no counter suffix and no
    // need to fold the cinema's name into the path.
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    shortId: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Relative path like "/uploads/1746842922821.PNG", matching every other
    // image field on the platform — the API serves /uploads statically.
    //
    // The poster is the portrait 2:3 artwork used on cards and grids.
    poster: {
      type: String,
      default: null,
    },
    // The landscape/banner artwork, for a film's own page and any hero strip.
    // A separate field rather than reusing the poster because the two crops are
    // not interchangeable: a 2:3 poster letterboxed into a banner slot looks
    // broken, which is why Event carries coverImages apart from its card image.
    coverImage: {
      type: String,
      default: null,
    },
    // Where the trailer lives (YouTube, Vimeo, a direct file). Stored as given
    // and never parsed here — embedding is a presentation decision, and a
    // strict URL shape would block a cinema from listing a film over a link
    // format we did not anticipate.
    trailerUrl: {
      type: String,
      trim: true,
    },
    // Theatrical release date. Distinct from createdAt (when the cinema added
    // the row) and from any showtime — a film can be listed as coming_soon
    // weeks before its first screening is scheduled.
    releaseDate: {
      type: Date,
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
    // Where the film sits in its life on this cinema's listing.
    //
    // Separate from isActive below, and the two mean different things:
    //   status   — how the film is PRESENTED (a trailer up before it opens,
    //              on the schedule now, or finished its run)
    //   isActive — whether the row is usable at all
    //
    // They are kept in step by a hook rather than left to every caller, because
    // two independent flags that mean overlapping things is exactly how a film
    // ends up archived-but-still-bookable. See the hook below.
    status: {
      type: String,
      enum: ["coming_soon", "now_showing", "archived"],
      default: "now_showing",
    },

    // Retiring a film hides it from the scheduling picker without deleting it,
    // which has to survive for the showtimes already scheduled against it.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Promoted to the top of the public cinema page.
    //
    // ADMIN-ONLY. A cinema cannot feature its own film, for the reason the
    // banner and featured-event flags on Event are admin-controlled: the slot is
    // shared shelf space across every cinema on the platform, so if the party
    // that benefits could set it, everyone would set it and the row would mean
    // nothing. The cinema-facing update handler ignores this field entirely
    // rather than validating it, so a cinema sending it simply has no effect.
    isFeatured: {
      type: Boolean,
      default: false,
    },
    // Lower sorts first. Lets an admin order the promoted row by hand instead of
    // it being whatever the database happened to return.
    featuredOrder: {
      type: Number,
      default: 0,
    },

    // The two other display slots, named and shaped exactly as Event's are, so
    // the admin surface and the public page behave identically for a film and
    // for an event:
    //
    //   bannerStatus — the big rotating hero carousel at the top of the page
    //   isTrending   — the "trending" strip further down
    //
    // ALL THREE ARE ADMIN-ONLY, for the reason isFeatured documents above: these
    // are shared shelf space across every cinema, so if the party who benefits
    // could set them, everyone would and the flags would mean nothing.
    bannerStatus: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    featuredSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    featuredSetAt: {
      type: Date,
    },

    // --- Admin publication gate --------------------------------------------
    //
    // Whether this film has been approved to face the public at all. A cinema
    // creates a film; an admin decides whether it goes live. Until it does, the
    // film is invisible to customers and no ticket can be sold for it.
    //
    // A SEPARATE FIELD FROM `status` ON PURPOSE. `status` is presentation —
    // coming soon, showing now, finished its run — and belongs to the cinema.
    // This is permission, and belongs to the admin. Folding them into one enum
    // would mean a cinema moving a film to "now_showing" could publish itself,
    // which is the entire thing this gate prevents.
    //
    // ADMIN-ONLY, like the three display slots above and for the same reason:
    // the party that benefits must not be the party that decides. The
    // cinema-facing update handler ignores this field rather than validating
    // it, so a cinema sending it simply has no effect.
    publicationStatus: {
      type: String,
      enum: ["pending", "published", "rejected"],
      default: "pending",
      required: true,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    publishedAt: {
      type: Date,
    },
    // Why an admin rejected it, shown back to the cinema so a rejection is
    // actionable rather than a silent refusal to go live.
    publicationNote: {
      type: String,
      trim: true,
      maxlength: 500,
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
// The dashboard groups a cinema's listing by lifecycle.
CinemaMovieSchema.index({ cinema: 1, status: 1, releaseDate: -1 });
// The public page's promoted row: every featured film across every cinema,
// in the admin's chosen order.
CinemaMovieSchema.index({ isFeatured: 1, isActive: 1, featuredOrder: 1 });
// The other two public rows, each read the same way.
CinemaMovieSchema.index({ bannerStatus: 1, isActive: 1 });
CinemaMovieSchema.index({ isTrending: 1, isActive: 1 });

CinemaMovieSchema.index({ shortId: 1 }, { unique: true, sparse: true });

// The admin review queue: everything awaiting a decision, oldest first, so the
// backlog is worked in the order cinemas submitted it.
CinemaMovieSchema.index({ publicationStatus: 1, createdAt: 1 });
// Every public read is scoped by publication, so it leads each of those indexes
// rather than being a filter applied after the fact.
CinemaMovieSchema.index({ publicationStatus: 1, isActive: 1, isFeatured: 1, featuredOrder: 1 });
CinemaMovieSchema.index({ publicationStatus: 1, isActive: 1, bannerStatus: 1 });
CinemaMovieSchema.index({ publicationStatus: 1, isActive: 1, isTrending: 1 });
CinemaMovieSchema.index({ cinema: 1, publicationStatus: 1 });

// Keep the URL fields populated, exactly as Event does.
//
// The slug follows the title so a renamed film gets a URL that matches it; the
// shortId never changes, so existing links keep resolving even after a rename.
CinemaMovieSchema.pre("validate", async function ensureMovieUrlFields(next) {
  try {
    if (this.isNew || this.isModified("title") || !this.slug) {
      this.slug = slugify(this.title);
    }
    if (!this.shortId) {
      this.shortId = await createUniqueShortId(this.constructor);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Keep status and isActive from contradicting each other.
//
// In the model rather than in the controller so that no write path — the
// dashboard, an admin edit, a future import — can leave a film marked archived
// while still selectable in the scheduling picker.
CinemaMovieSchema.pre("save", function syncStatusAndActive(next) {
  if (this.isModified("status")) {
    // Archiving retires the row; un-archiving brings it back.
    this.isActive = this.status !== "archived";
  } else if (this.isModified("isActive") && this.isActive === false) {
    // Retired through the older flag: reflect it in the lifecycle too.
    this.status = "archived";
  }
  next();
});

// A film that is edited after approval goes back into the queue.
//
// Without this, publication would be a one-time key: a cinema could submit a
// bland placeholder, get it approved, then rewrite the title, synopsis and
// poster into anything at all. Only the fields a customer actually sees trigger
// re-review — rescheduling or restocking must not cost a cinema its listing.
//
// In the model rather than the controller so it holds for every write path.
const CUSTOMER_FACING_FIELDS = [
  "title",
  "description",
  "poster",
  "coverImage",
  "trailerUrl",
  "genre",
  "language",
  "subtitles",
  "ageRating",
  "durationMinutes",
  "releaseDate",
];

CinemaMovieSchema.pre("save", function requeueOnCustomerFacingEdit(next) {
  if (this.isNew) return next();
  // An admin's own decision must not undo itself: when publicationStatus is
  // part of this same save, that is the review landing, not a cinema edit.
  if (this.isModified("publicationStatus")) return next();
  if (this.publicationStatus !== "published") return next();

  if (CUSTOMER_FACING_FIELDS.some((field) => this.isModified(field))) {
    this.publicationStatus = "pending";
    this.publishedBy = undefined;
    this.publishedAt = undefined;
    this.publicationNote = "Returned for review after the listing was edited.";
  }
  next();
});

module.exports = mongoose.model("CinemaMovie", CinemaMovieSchema);
