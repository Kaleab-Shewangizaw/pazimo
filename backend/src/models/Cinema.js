const mongoose = require("mongoose");
const {
  DEFAULT_COMMISSION_RATE,
  MIN_COMMISSION_RATE,
  MAX_COMMISSION_RATE,
} = require("../config/rates");

// A cinema that sells screening tickets and concessions through Pazimo.
//
// This is the cinema channel's answer to Event, and the parallel is the same one
// Venue draws: on the event side the sales context is an Event, which carries the
// commission rates and the VAT-coverage flag that every sale snapshots. A cinema
// runs continuously rather than per occasion, so the cinema itself IS the sales
// context and carries those settings.
//
//   Beverage         ─┬─ EventBeverage  ── Event  ── Organizer  (event channel)
//                      └─ VenueBeverage  ── Venue  ── Venue account (venue channel)
//   ConcessionProduct ── CinemaBeverage ── Cinema ── Cinema account (cinema channel)
//
//   Ticket        ── Event   ── Organizer                     (event channel)
//   CinemaTicket  ── CinemaShowtime ── CinemaMovie ── Cinema  (cinema channel)
//
// Cinema concessions deliberately do NOT hang off Beverage. A cinema counter
// and an event bar sell, price and report on completely different things, so
// they read from a completely different catalogue — see ConcessionProduct.
//
// A cinema is deliberately NOT modelled as an organizer with a permanent event,
// and a screening is NOT an Event. A dummy event per showing would put cinema
// takings inside every "what did my events earn?" figure on the platform and
// fill the public events listing with thirty showings of one film — exactly the
// mixing this channel exists to avoid.
//
// Unlike a venue, a cinema sells BOTH tickets and drinks, so it carries two
// commission rates. They move independently: the cut on a cinema seat is a
// different negotiation from the cut on its popcorn.
const CinemaSchema = new mongoose.Schema(
  {
    // The login. A User with role "cinema" — the cinema channel reuses the
    // existing account, JWT, ban and authorization machinery rather than
    // inventing a second identity system, the same way venues and admins do.
    //
    // One account owns exactly one cinema: the account IS the cinema's identity,
    // so a second row against the same user would make "which cinema am I?"
    // ambiguous on every self-service route.
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Cinema name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    // Relative path like "/uploads/1746842922821.PNG", matching Beverage, Venue
    // and Event — the API serves /uploads statically.
    image: {
      type: String,
      default: null,
    },

    // Suspending a cinema stops it selling without deleting it, which has to
    // survive for the sales already recorded against it.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Approval to sell CONCESSIONS, granted by an admin and never by the cinema
    // itself. Ticket selling is not gated by this: a cinema exists to sell
    // seats, so gating that would make an approved-but-not-eligible cinema
    // useless. Drinks are the added privilege, exactly as they are for an
    // organizer (OrganizerBeverageProfile) and a venue (Venue.eligibility).
    beverageEligibility: {
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

    // Products from ConcessionProduct this cinema MAY sell — an allow list.
    //
    // The event and venue channels (OrganizerBeverageProfile, Venue) use deny
    // lists, and the reason is worth stating because this deliberately differs:
    // with a deny list, a product added to the catalogue later is immediately
    // sellable by everyone, which is the right default when the catalogue is a
    // general one. Cinema concessions are curated per site — a cinema sells the
    // brands it has a supply deal for — so the admin grants them explicitly.
    //
    // The cost is real and is the reason this is not the platform-wide default:
    // a new product is invisible to every cinema until it is granted, and a new
    // cinema can sell nothing until someone grants it something. Both are admin
    // work that grows with the number of cinemas.
    //
    // An EMPTY list therefore means "nothing", not "everything".
    allowedConcessions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ConcessionProduct",
      },
    ],
    allowedConcessionsSetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    allowedConcessionsSetAt: {
      type: Date,
    },

    // Pazimo's cut on this cinema's TICKET sales — the cinema-channel twin of
    // Event.commissionRate, with the same 3% default and the same band.
    // Snapshotted per ticket on CinemaTicket.commissionRate, so renegotiating it
    // never restates takings already reported or paid out.
    ticketCommissionRate: {
      type: Number,
      default: DEFAULT_COMMISSION_RATE,
      min: MIN_COMMISSION_RATE,
      max: MAX_COMMISSION_RATE,
    },

    // Pazimo's cut on this cinema's CONCESSION sales — the twin of
    // Event.beverageCommissionRate. Independent of the ticket rate above for the
    // same reason the event side keeps them apart: a cinema may take a different
    // cut on popcorn than on seats.
    beverageCommissionRate: {
      type: Number,
      default: DEFAULT_COMMISSION_RATE,
      min: MIN_COMMISSION_RATE,
      max: MAX_COMMISSION_RATE,
    },

    // Whether Pazimo withholds this cinema's own 15% VAT and remits it for them.
    // The cinema-channel twin of Event.coversOrganizerVat and Venue.coversVenueVat,
    // and like them, governs FUTURE sales only — each sale snapshots its own rate.
    //
    // Applies to both streams: coverage is a property of the business, not of
    // what it happens to be selling.
    //
    // The withheld money is a liability, never Pazimo revenue; every "Pazimo
    // earned" figure excludes it.
    coversCinemaVat: {
      type: Boolean,
      default: false,
    },

    // Default minutes between screenings in any of this cinema's halls, for
    // emptying, cleaning and re-seating the room.
    //
    // Lives on the cinema so an operator sets it once rather than per hall; a
    // hall that genuinely differs overrides it via CinemaHall.turnaroundMinutes.
    // Overlap detection adds this to a screening's end before deciding the room
    // is free, which is what stops a schedule that is technically non-
    // overlapping but physically impossible to run.
    turnaroundMinutes: {
      type: Number,
      min: 0,
      default: 15,
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

// Case-insensitive uniqueness on name, matching Beverage and Venue: two cinemas
// called "Century Cinema" and "century cinema" would be indistinguishable in
// every picker and every report.
CinemaSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
CinemaSchema.index({ isActive: 1, name: 1 });
CinemaSchema.index({ beverageEligibility: 1, isActive: 1 });

module.exports = mongoose.model("Cinema", CinemaSchema);
