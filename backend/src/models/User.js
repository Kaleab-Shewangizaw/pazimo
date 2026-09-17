const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { normalizePhone } = require("../utils/phone");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[\d\s-]{10,}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    // Canonical "+<countrycode><number>" form of phoneNumber, kept in sync by
    // the pre-save hook below. phoneNumber itself stays free-form (existing
    // logins/reports depend on its stored shape), so exact-match phone search
    // (see ticketShareService.searchRecipients) has one normalized field to
    // compare against instead of every historical format a number was typed
    // in. Not unique: the same phone can legitimately back more than one
    // role (see the phoneNumber+role compound index below).
    normalizedPhone: {
      type: String,
      index: true,
    },
    // Telegram-style handle for exact-match user search/sharing (see
    // ticketShareService.searchRecipients). Optional and unset for every
    // account created before this field existed — sparse so those millions
    // of `null`s don't collide on the unique index. A user claims one via
    // PUT /api/auth/update-username.
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: [4, "Username must be at least 4 characters"],
      maxlength: [20, "Username must be at most 20 characters"],
      match: [
        /^[a-z0-9_]+$/,
        "Username can only contain lowercase letters, numbers and underscores",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    // "venue" is a club, bar, restaurant or lounge that sells drinks through
    // Pazimo without running events. It is a login and nothing more — the
    // business itself lives in the Venue model, which this account owns.
    //
    // "cinema" is a cinema business selling screening tickets and concessions.
    // Same arrangement: a login only, with the business in the Cinema model that
    // this account owns. It differs from "venue" in selling two things rather
    // than one, so it settles two pools instead of one.
    //
    // A new role rather than a flag on organizer: the three settle different
    // pools, and restrictTo() must be able to say "organizers only" on the
    // event-side money routes without a venue or a cinema slipping through.
    // Every route that admits "venue" or "cinema" does so explicitly.
    //
    // "usher" is door staff: a scan-only account with no money or ownership
    // attached to it at all. It never owns an event — it gets scoped, one
    // event at a time, by redeeming that event's EventUsherCode, which creates
    // a UsherEventAccess grant. Ticket check-in/validate-qr check that grant
    // for this role; every other route stays exactly as closed to it as to a
    // customer unless explicitly opened up.
    //
    // "cashier" is a cinema's or venue's own counter staff — the usher
    // equivalent for these two channels, but scoped permanently to ONE
    // business (via the `cinema`/`venue` field below) rather than redeeming a
    // per-event code. It can sell/scan/redeem at the counter and read that
    // business's own sales history, but never touch finance, catalogue/hall/
    // showtime/happy-hour management, the business's own profile/security, or
    // create more cashiers — every route that admits it does so explicitly,
    // same discipline as "venue"/"cinema" above.
    role: {
      type: String,
      enum: ["customer", "organizer", "venue", "cinema", "usher", "cashier"],
      required: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: function () {
        return this.role === "organizer";
      },
      trim: true,
    },
    // Relative path (e.g. "/uploads/1234.jpg") — same convention as
    // Beverage/Event/Category images. The API host serves /uploads
    // statically; clients prefix their own API origin.
    profilePicture: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // isBanned is set alongside isActive:false whenever the fraud guard (or
    // an admin) bans an account — it exists purely so bans can be filtered/
    // reported on distinctly from any other reason an account might be
    // inactive. Access is still enforced via isActive in the auth
    // middleware; isBanned never gates access on its own.
    isBanned: {
      type: Boolean,
      default: false,
      index: true,
    },
    banReason: {
      type: String,
    },
    bannedAt: {
      type: Date,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    tickets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Ticket",
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    // Gates actual push delivery — see `pushService.js`. Kept separate from
    // `notificationPreferences` below on purpose: those are what the user
    // wants, this is where to physically send it.
    notificationPreferences: {
      ticketUpdates: { type: Boolean, default: true },
      chatMessages: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
    },
    // Expo push tokens for every device this account is signed into — an
    // array, not a single field, since the same person can have the app on a
    // phone and a tablet at once. Deduplicated on registration; an
    // "InvalidCredentials"/"DeviceNotRegistered" receipt from Expo's push
    // service (see `pushService.js`) is what prunes a stale one, since there
    // is no sign-out call to do it eagerly.
    pushTokens: {
      type: [String],
      default: [],
    },
    // OTP-based login (organizers only, added 2026-09-03). The code itself
    // never sits in the database in plain form — only its hash does.
    // otpAttempts caps guesses against the 6-digit code independent of the
    // per-IP rate limiter, since a shared NAT/proxy IP shouldn't cost a real
    // organizer their remaining attempts and an attacker with many IPs
    // shouldn't get unlimited guesses against one account either.
    otpCodeHash: String,
    otpExpires: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    // Forgot-password OTP (added 2026-09-03), same shape and hash-before-
    // store approach as the login OTP above but kept in separate fields so a
    // code sent to prove "let me reset my password" can never be replayed
    // against verify-otp to sign in without changing anything, and a
    // sign-in code can never be used to reset a password.
    resetOtpCodeHash: String,
    resetOtpExpires: Date,
    resetOtpAttempts: {
      type: Number,
      default: 0,
    },
    // Phone-verification OTP — proves the number on the account is reachable
    // by its owner. Used right after registration (before a token is issued)
    // and again from account settings for any pre-existing account that
    // still shows isPhoneVerified:false. Separate fields for the same reason
    // as resetOtp* above: a code issued to prove phone ownership must never
    // be replayable against the sign-in or password-reset endpoints.
    registerOtpCodeHash: String,
    registerOtpExpires: Date,
    registerOtpAttempts: {
      type: Number,
      default: 0,
    },
    // Self-serve login 2FA (added 2026-09-16) — a customer opts into this
    // from account settings once isPhoneVerified is true; unrelated to
    // ORGANIZER_LOGIN_OTP_ENABLED below, which is a role-wide env-gated
    // switch rather than a per-account choice. See login()'s comment in
    // authController.js for how the two combine.
    otpEnabled: {
      type: Boolean,
      default: false,
    },
    // Which business a "cashier" account is scoped to. Exactly one of these
    // two is set when role is "cashier" (enforced below) and both stay null
    // for every other role — a cashier is never its own business the way
    // "venue"/"cinema" accounts are, it is staff borrowing one business's
    // counter, so the FK points at the business rather than the business
    // pointing at an "account" the way Cinema/Venue do for their owners.
    cinema: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cinema",
      default: null,
    },
    venue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ phoneNumber: 1, role: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index(
  { firstName: 'text', lastName: 'text', email: 'text', phoneNumber: 'text' },
  {
    name: 'user_search_text_index',
    weights: { firstName: 10, lastName: 10, email: 8, phoneNumber: 6 }
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// A cashier must be scoped to exactly one business, and no other role may
// carry that scoping at all — otherwise resolveCinema/resolveVenueContext
// (which trust these fields to say which business a cashier may act as)
// could be pointed at two businesses at once, or a stray cinema/venue id
// could silently survive a role change and outlive its meaning.
userSchema.pre("validate", function (next) {
  if (this.role === "cashier") {
    const hasCinema = !!this.cinema;
    const hasVenue = !!this.venue;
    if (hasCinema === hasVenue) {
      return next(
        new Error(
          "A cashier account must be linked to exactly one cinema or venue, not both or neither."
        )
      );
    }
  } else if (this.cinema || this.venue) {
    return next(
      new Error('Only a "cashier" account may be linked to a cinema or venue.')
    );
  }
  next();
});

// Keeps normalizedPhone in lockstep with phoneNumber. Existing accounts get
// theirs from the one-off backfill script (see
// scripts/backfillUserNormalizedPhone.js) rather than this hook, since it
// only runs on save.
userSchema.pre("save", function (next) {
  if (!this.isModified("phoneNumber")) return next();
  this.normalizedPhone = normalizePhone(this.phoneNumber) || undefined;
  next();
});

// Method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to create JWT
userSchema.methods.createJWT = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for organizer profile
userSchema.virtual("organizerProfile", {
  ref: "OrganizerRegistration",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

const User = mongoose.model("User", userSchema);
module.exports = User;
