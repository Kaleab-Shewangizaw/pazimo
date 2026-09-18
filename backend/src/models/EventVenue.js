const mongoose = require("mongoose");

// A physical place events happen at — a concert hall, a stadium, a club — kept
// as its own directory so a customer can browse and search "where" independently
// of "what event is showing there right now".
//
// This is NOT the same thing as Venue: that model is a business account that
// sells drinks through Pazimo (a bar, a lounge) and requires a login. An
// EventVenue is a plain, admin-curated directory entry with no account behind
// it, the same relationship ConcessionProduct has to Beverage — a distinct
// concept that happens to share a name in casual speech.
//
// Event does not reference this collection: Event.location is a free-form
// address snapshot, not a link to a venue row, so creating an EventVenue entry
// does not change how events are created or displayed. This directory exists
// purely so "search venues" has something real to search.
const EventVenueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    // Optional — most directory entries are found by name/city text search, not
    // by proximity, so this has no default and no geo index. A `type` default
    // of "Point" without required coordinates would leave the field looking
    // like a GeoJSON point when it isn't one, so both are left unset instead.
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    // Relative path like "/uploads/1746842922821.PNG", matching Cinema and Venue.
    image: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

EventVenueSchema.index(
  { name: 1, city: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
EventVenueSchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model("EventVenue", EventVenueSchema);
