const mongoose = require("mongoose");

// Same shape and reasoning as EventUsherCode — see that file's comments.
// Kept as its own model rather than reusing EventUsherCode with a `kind`
// field: a cashier's code and an usher's code for the same event are
// unrelated (different holders, different scanning purpose), and one
// `event` per doc with a `unique` index is what makes "regenerate this
// event's code" a simple upsert for either.
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const generateCode = () => {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
};

const EventCashierCodeSchema = new mongoose.Schema(
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
    // organizer. refPath because those two live in separate collections.
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

EventCashierCodeSchema.statics.generateCode = generateCode;

module.exports = mongoose.model("EventCashierCode", EventCashierCodeSchema);
