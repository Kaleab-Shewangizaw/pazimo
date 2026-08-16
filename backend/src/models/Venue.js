const mongoose = require("mongoose");
const {
  DEFAULT_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
} = require("../config/rates");

// A business that sells drinks through Pazimo without running events: a club, a
// bar, a restaurant, a lounge.
//
// This is the venue channel's answer to Event. That parallel is the whole point:
// on the event side the sales context is an Event, which carries the commission
// rate and the VAT-coverage flag that every sale snapshots. A venue sells
// continuously rather than per occasion, so the venue itself IS the sales
// context and carries those same two settings.
//
//   Beverage ── EventBeverage ── Event ── Organizer      (event channel)
//            └─ VenueBeverage ── Venue ── Venue account  (venue channel)
//
// A venue is deliberately NOT modelled as an organizer with a permanent event.
// A dummy event would put venue takings inside every "what did my events earn?"
// figure on the platform, which is exactly the mixing this channel must avoid.
const VenueSchema = new mongoose.Schema(
  {
    // The login. A User with role "venue" — the venue channel reuses the
    // existing account, JWT, ban and authorization machinery rather than
    // inventing a second identity system, the same way admins reuse restrictTo.
    //
    // One account owns exactly one venue: the account IS the venue's identity,
    // so a second row against the same user would make "which venue am I?"
    // ambiguous on every self-service route.
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Venue name is required"],
      trim: true,
    },
    // What kind of place this is. Reporting groups by it, and it is the only
    // thing that distinguishes a club from a restaurant for an admin scanning
    // the list — the selling behaviour is identical for every type.
    venueType: {
      type: String,
      enum: ["club", "bar", "restaurant", "lounge", "entertainment", "other"],
      default: "other",
    },
    city: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    // Relative path like "/uploads/1746842922821.PNG", matching Beverage and
    // Event — the API serves /uploads statically.
    image: {
      type: String,
      default: null,
    },

    // Suspending a venue stops it selling without deleting it, which has to
    // survive for the sales already recorded against it.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Approval to sell, granted by an admin and never by the venue itself.
    //
    // On the organizer side this lives in OrganizerBeverageProfile, a side table,
    // because a User is a general account that may never touch beverages. A
    // Venue exists only to sell them, so a separate profile collection would be
    // a row-for-row shadow of this one — the fields belong here.
    eligibility: {
      type: String,
      enum: ["not_eligible", "eligible"],
      default: "not_eligible",
    },
    eligibilitySetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    eligibilitySetAt: {
      type: Date,
    },
    eligibilityNotes: {
      type: String,
      trim: true,
    },

    // Beverages this venue may NOT sell — a deny list, for the same reason
    // OrganizerBeverageProfile.blockedBeverages is one: with an allow list every
    // drink added to the catalogue later would be invisible to every venue an
    // admin had ever narrowed, until someone reopened each profile.
    blockedBeverages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Beverage",
      },
    ],
    blockedBeveragesSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    blockedBeveragesSetAt: {
      type: Date,
    },

    // Pazimo's cut on this venue's drink sales — the venue-channel twin of
    // Event.beverageCommissionRate, with the same 3% default and the same band.
    // Snapshotted per sale on VenueBeverageSale.commissionRate, so renegotiating
    // it never restates takings already reported or paid out.
    beverageCommissionRate: {
      type: Number,
      default: DEFAULT_COMMISSION_RATE,
      min: MIN_COMMISSION_RATE,
      max: MAX_COMMISSION_RATE,
    },

    // Whether Pazimo withholds this venue's own 15% VAT and remits it for them.
    // The venue-channel twin of Event.coversOrganizerVat, and like it, governs
    // FUTURE sales only — each sale snapshots its own rate.
    //
    // The withheld money is a liability, never Pazimo revenue; every "Pazimo
    // earned" figure excludes it.
    coversVenueVat: {
      type: Boolean,
      default: false,
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

// Case-insensitive uniqueness on name, matching Beverage: two venues called
// "Flirt Lounge" and "flirt lounge" would be indistinguishable in every picker
// and every report.
VenueSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
VenueSchema.index({ eligibility: 1, isActive: 1 });
VenueSchema.index({ venueType: 1, name: 1 });

module.exports = mongoose.model("Venue", VenueSchema);
