const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const conditionalSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    operator: { type: String, enum: ["lt", "eq", "gt"], required: true },
    value: { type: Number, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "short_text",
        "long_text",
        "single_choice",
        "multi_choice",
        "dropdown",
        "phone",
        "email",
        "file",
        "date",
        "rating",
        "emoji",
        "nps",
        "yes_no",
      ],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
    conditional: { type: conditionalSchema, default: undefined },
    sectionId: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    id: { type: String, default: uuidv4 },
    title: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    deadline: { type: String },
  },
  { _id: false }
);

const rsvpFormSchema = new mongoose.Schema(
  {
    formId: {
      type: String,
      unique: true,
      index: true,
      default: uuidv4,
    },
    publicId: {
      type: String,
      unique: true,
      index: true,
      default: uuidv4,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["rsvp", "review"],
      default: "rsvp",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "hidden", "archived", "review", "closed"],
      default: "draft",
      index: true,
    },
    isFeatured: { type: Boolean, default: false, index: true },
    isTrending: { type: Boolean, default: false, index: true },
    bannerStatus: { type: Boolean, default: false, index: true },
    isPublic: { type: Boolean, default: true, index: true },
    isClosed: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    coverImage: { type: String, default: "" },
    date: { type: String, default: "" },
    hostedBy: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    location: { type: String, default: "" },
    venue: { type: String, default: "" },
    rsvpLimit: { type: Number },
    approvalMode: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto",
    },
    collectAttendeeInfo: {
      type: Boolean,
      default: true,
    },
    payment: { type: paymentSchema, default: undefined },
    anonymous: { type: Boolean, default: false },
    sections: { type: [sectionSchema], default: [] },
    questions: { type: [questionSchema], default: [] },
    responseCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    publishedAt: { type: Date },
    cancelledAt: { type: Date },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

rsvpFormSchema.index({ organizerId: 1, updatedAt: -1 });
rsvpFormSchema.index({ status: 1, createdAt: -1 });
rsvpFormSchema.index({ isTrending: 1, status: 1, createdAt: -1 });
rsvpFormSchema.index({ isFeatured: 1, status: 1, createdAt: -1 });
rsvpFormSchema.index({ bannerStatus: 1, status: 1, createdAt: -1 });
rsvpFormSchema.index({ isPublic: 1, status: 1, createdAt: -1 });
rsvpFormSchema.index({ deletedAt: 1, createdAt: -1 });
rsvpFormSchema.index({ publicId: 1, status: 1 });

module.exports = mongoose.model("RsvpForm", rsvpFormSchema);
