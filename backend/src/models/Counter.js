const mongoose = require("mongoose");

// Generic atomic sequence generator. Mongo has no native auto-increment, so
// reference numbers (or anything else needing a gapless-enough running
// count) go through getNextSequence(), which uses findOneAndUpdate's atomic
// $inc — safe under concurrent requests, unlike "count documents + 1".
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", CounterSchema);

const getNextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

module.exports = { Counter, getNextSequence };
