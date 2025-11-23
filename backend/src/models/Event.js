const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an event title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide an event description'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Please provide an event category'],
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Please provide a start date'],
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
        enum: ['Point'],
        default: 'Point',
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
      ref: 'User',
      required: false,
    },
    coverImages: {
      type: [String],
      default: ['default-event.jpg'],
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
          required: true,
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

        startDate: {
          type: Date,
          required: false,  
        },
        endDate: {
          type: Date,
          required: false,  
        },
      },
    ],




    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
      default: 'draft',
    },
    bannerStatus: {
      type: Boolean,
      default: false,
    },
    capacity: {
      type: Number,
      required: [true, 'Please provide event capacity'],
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
EventSchema.virtual('tickets', {
  ref: 'Ticket',
  localField: '_id',
  foreignField: 'event',
  justOne: false,
});

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;