const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const campaignSchema = new mongoose.Schema(
  {
    campaignId: {
      type: String,
      unique: true,
      default: uuidv4,
    },
    title: {
      type: String,
      required: true,
      default: "Untitled Campaign",
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    targetedEvents: [
      {
        eventName: String,
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Event",
        },
      },
    ],
    message: {
      type: String,
      required: true,
    },
    recipients: [
      {
        name: String,
        phone: String,
        source: {
          type: String,
          enum: ["manual", "event", "top-customer", "import"],
          default: "manual",
        },
      },
    ],
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "active",
        "pending_payment",
        "processing",
        "completed",
        "failed",
      ],
      default: "draft",
    },
    paymentId: {
      type: String,
    },
    // Keep internal tracking if needed, or remove if recipients covers it
    totalRecipients: {
      type: Number,
      default: 0,
    },
    costProfile: {
      smsPrice: Number,
      totalCost: Number,
    },
    metadata: Object,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Campaign", campaignSchema);
