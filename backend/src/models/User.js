const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
    role: {
      type: String,
      enum: ["customer", "organizer", "venue", "cinema"],
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
    passwordResetToken: String,
    passwordResetExpires: Date,
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
