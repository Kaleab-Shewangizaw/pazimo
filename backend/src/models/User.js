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
    // "usher" is door staff: a scan-only account with no money or ownership
    // attached to it at all. It never owns an event — it gets scoped, one
    // event at a time, by redeeming that event's EventUsherCode, which creates
    // a UsherEventAccess grant. Ticket check-in/validate-qr check that grant
    // for this role; every other route stays exactly as closed to it as to a
    // customer unless explicitly opened up.
    role: {
      type: String,
      enum: ["customer", "organizer", "usher"],
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
    // OTP-based login (organizers only). Hash-before-store — the code
    // itself never sits in the database in plain form. otpAttempts caps
    // guesses against the 6-digit code independent of the per-IP rate
    // limiter, since a shared NAT/proxy IP shouldn't cost a real organizer
    // their remaining attempts and an attacker with many IPs shouldn't get
    // unlimited guesses against one account either.
    otpCodeHash: String,
    otpExpires: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    // OTP-based password reset — replaces the old passwordResetToken/
    // passwordResetExpires email-link flow entirely (removed). Kept in
    // separate fields from the login OTP above (not reused) so a reset code
    // can never be replayed to sign in, and a sign-in code can never be
    // used to change the password — see generateAndSendOtp's
    // OTP_FIELDS_BY_PURPOSE in authController.js.
    resetOtpCodeHash: String,
    resetOtpExpires: Date,
    resetOtpAttempts: {
      type: Number,
      default: 0,
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
