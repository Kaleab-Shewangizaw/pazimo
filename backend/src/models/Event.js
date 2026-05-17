const mongoose = require("mongoose");
const { generateShortId, slugify } = require("../utils/eventUrl");

const createUniqueShortId = async (EventModel) => {
  while (true) {
    const shortId = await generateShortId();
    const existing = await EventModel.exists({ shortId });
    if (!existing) return shortId;
  }
};

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide an event title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    slug: {
      type: String,
      trim: true,
      index: true,
    },
    shortId: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isTrending: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      required: [true, "Please provide an event description"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please provide an event category"],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: [true, "Please provide a start date"],
    },
    endDate: {
      type: Date,
      required: false, // Make end date optional
    },
    startTime: {
      type: String,
      required: false, // Optional start time
    },
    endTime: {
      type: String,
      required: false, // Optional end time
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
      address: String,
      city: String,
      country: String,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    coverImages: {
      type: [String],
      default: ["default-event.jpg"],
    },
    eventImages: [
      {
        url: {
          type: String,
          required: true,
        },
        caption: String,
      },
    ],

    ticketTypes: [
      {
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: false, // Made optional for backward compatibility
        },
        priceETB: {
          type: Number,
          required: false, // Price in Ethiopian Birr
        },
        priceUSD: {
          type: Number,
          required: false, // Price in US Dollars
        },
        quantity: {
          type: Number,
          required: true,
        },
        description: String,
        available: {
          type: Boolean,
          default: true,
        },
        manualDisabled: {
          type: Boolean,
          default: false,
        },

        startDate: {
          type: Date,
          required: false,
        },
        endDate: {
          type: Date,
          required: false,
        },
        waveGroup: {
          type: String,
          required: false,
        },
        waveOrder: {
          type: Number,
          required: false,
        },
        waveSwitchMode: {
          type: String,
          enum: [
            "date",
            "quantity",
            "date_or_quantity",
            "by_time",
            "by_sold_out",
            "by_time_or_sold_out",
          ],
          default: "date_or_quantity",
        },
      },
    ],

    status: {
      type: String,
      enum: ["draft", "published", "cancelled", "completed"],
      default: "draft",
    },
    bannerStatus: {
      type: Boolean,
      default: false,
    },
    capacity: {
      type: Number,
      required: [true, "Please provide event capacity"],
    },
    tags: [String],
    ageRestriction: {
      hasRestriction: {
        type: Boolean,
        default: false,
      },
      minAge: {
        type: Number,
        min: 0,
        max: 120,
      },
      maxAge: {
        type: Number,
        min: 0,
        max: 120,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for tickets
EventSchema.virtual("tickets", {
  ref: "Ticket",
  localField: "_id",
  foreignField: "event",
  justOne: false,
});

// Add indexes for better query performance
EventSchema.index({ organizer: 1, createdAt: -1 }); // For organizer event queries
EventSchema.index({ status: 1, startDate: 1 }); // For filtering published/active events
EventSchema.index({ category: 1, status: 1 }); // For category-based filtering
EventSchema.index({ createdAt: -1 }); // For sorting by creation date
EventSchema.index({ shortId: 1 }, { unique: true, sparse: true });

EventSchema.pre("validate", async function ensureEventUrlFields(next) {
  try {
    if (this.isNew || this.isModified("title") || !this.slug) {
      this.slug = slugify(this.title);
    }

    if (!this.shortId) {
      this.shortId = await createUniqueShortId(this.constructor);
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Event = mongoose.model("Event", EventSchema);

module.exports = Event;
