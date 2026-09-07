const mongoose = require("mongoose");

// Excludes 0/O/1/I/L — the whole point of this code is that an organizer
// reads it aloud or texts it to someone standing at a gate, so characters
// that are easy to misdictate or mistype are left out.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const generateCode = () => {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
};

// One doc per event. Deliberately stored in plaintext rather than hashed
// (unlike the OTP fields on User): an organizer needs to redisplay the same
// code to hand it to a second or third usher without rotating it, the way a
// classroom join code works. Hashing would make it write-only and force a
// rotation every time it needs to be shared again.
const EventUsherCodeSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    // Whoever last generated/regenerated it — an admin or the event's own
    // organizer, per the "admin and/or organizer" access rule this exists to
    // support. refPath because those two live in separate collections.
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "generatedByModel",
    },
    generatedByModel: {
      type: String,
      required: true,
      enum: ["User", "Admin"],
    },
  },
  { timestamps: true }
);

EventUsherCodeSchema.statics.generateCode = generateCode;

module.exports = mongoose.model("EventUsherCode", EventUsherCodeSchema);
