const mongoose = require("mongoose")

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Create a compound index to ensure a user can only add an event once
wishlistSchema.index({ userId: 1, eventId: 1 }, { unique: true })

module.exports = mongoose.model("Wishlist", wishlistSchema)
