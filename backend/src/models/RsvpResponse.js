const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const rsvpResponseSchema = new mongoose.Schema(
  {
    responseId: {
      type: String,
      unique: true,
      index: true,
      default: uuidv4,
    },
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RsvpForm",
      required: true,
      index: true,
    },
    formPublicId: {
      type: String,
      required: true,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    answers: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    attendee: {
      fullName: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    qrCodePayload: {
      type: String,
      default: "",
    },
    qrCodeDataUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "unpaid", "rejected"],
      default: "pending",
      index: true,
    },
    tag: {
      type: String,
      enum: ["VIP", "Guest", "Press"],
      default: "Guest",
      index: true,
    },
    metadata: {
      userAgent: { type: String, default: "" },
      ip: { type: String, default: "" },
      referrer: { type: String, default: "" },
      sourceUrl: { type: String, default: "" },
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    checkedIn: {
      type: Boolean,
      default: false,
      index: true,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

rsvpResponseSchema.index({ formId: 1, createdAt: -1 });
rsvpResponseSchema.index({ organizerId: 1, createdAt: -1 });
// Accelerates status-filtered targeting (bulk messaging by status) and any
// dashboard filter on a form's responses by status.
rsvpResponseSchema.index({ formId: 1, status: 1 });
// Replaces the old { responseId: 1, checkedIn: 1 } index: responseId is
// already unique and indexed alone, so that compound never accelerated any
// query. This one does — it's the per-event "how many have checked in" count.
rsvpResponseSchema.index({ formId: 1, checkedIn: 1 });

module.exports = mongoose.model("RsvpResponse", rsvpResponseSchema);
