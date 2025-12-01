const Event = require("../models/Event");
const Wishlist = require("../models/Wishlist");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} = require("../errors");
const cloudinary = require("../config/cloudinary");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

// Create event
// const createEvent = async (req, res) => {
//   const { title, description, category, startDate, endDate, location, ticketTypes, capacity, tags, organizer } = req.body;

//   if (!organizer) {
//     throw new BadRequestError('Organizer ID is required');
//   }

//   // Handle image upload if present
//   let coverImage = 'default-event.jpg';
//   if (req.file) {
//     // Use the file path directly from multer
//     coverImage = `/uploads/${req.file.filename}`;
//   }

//   // Create event with organizer ID from request body
//   const event = await Event.create({
//     title,
//     description,
//     category,
//     startDate,
//     endDate,
//     location: {
//       type: 'Point',
//       coordinates: [0, 0],
//       ...location,
//     },
//     coverImage,
//     ticketTypes: Array.isArray(ticketTypes) ? ticketTypes : JSON.parse(ticketTypes),
//     capacity,
//     tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
//     status: 'draft',
//     organizer // Use the organizer ID from request body
//   });

//   res.status(StatusCodes.CREATED).json({
//     status: 'success',
//     data: { event }
//   });
// };

// Create event
const createEvent = async (req, res) => {
  const {
    title,
    description,
    category,
    isPublic,
    startDate,
    endDate,
    startTime,
    endTime,
    location,
    ticketTypes,
    capacity,
    tags,
    organizer,
    ageRestriction,
  } = req.body;

  if (!organizer) {
    throw new BadRequestError("Organizer ID is required");
  }

  // Handle image uploads if present
  let coverImages = ["default-event.jpg"];
  if (req.files && req.files.length > 0) {
    coverImages = req.files.map((file) => `/uploads/${file.filename}`);
  }

  // Handle ticket types with optional dates
  const parsedTicketTypes = Array.isArray(ticketTypes)
    ? ticketTypes
    : JSON.parse(ticketTypes);

  // Process ticket types and ensure dates are optional
  const ticketTypesWithDates = parsedTicketTypes.map((ticket) => {
    return {
      ...ticket,
      startDate: ticket.startDate ? new Date(ticket.startDate) : null,
      endDate: ticket.endDate ? new Date(ticket.endDate) : null,
    };
  });

  // Prepare event data
  const eventData = {
    title,
    description,
    category,
    startDate,
    location: {
      type: "Point",
      coordinates: [0, 0],
      ...location,
    },
    coverImages,
    ticketTypes: ticketTypesWithDates,
    capacity,
    tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
    status: "draft",
    organizer, // Use the organizer ID from request body
  };

  // Add optional fields only if they exist
  if (endDate) {
    eventData.endDate = endDate;
  }
  if (startTime) {
    eventData.startTime = startTime;
  }
  if (endTime) {
    eventData.endTime = endTime;
  }
  if (ageRestriction && ageRestriction.hasRestriction) {
    eventData.ageRestriction = {
      hasRestriction: true,
      minAge: ageRestriction.minAge
        ? parseInt(ageRestriction.minAge)
        : undefined,
      maxAge: ageRestriction.maxAge
        ? parseInt(ageRestriction.maxAge)
        : undefined,
    };
  }
  if (isPublic !== undefined) {
    eventData.isPublic = isPublic === "true" || isPublic === true;
  }

  // Create event
  const event = await Event.create(eventData);

  res.status(StatusCodes.CREATED).json({
    status: "success",
    data: { event },
  });
};

// Buy Ticket
// const buyTicket = async (req, res) => {
//   const { id: eventId } = req.params;
//   const { userId, ticketType, quantity } = req.body;

//   if (!userId || !ticketType || !quantity) {
//     throw new BadRequestError('Missing required fields: userId, ticketType, or quantity');
//   }

//   const event = await Event.findById(eventId);
//   if (!event) {
//     throw new NotFoundError('Event not found');
//   }

//   const ticketTypeIndex = event.ticketTypes.findIndex(t => t.name === ticketType);
//   if (ticketTypeIndex === -1) {
//     throw new BadRequestError('Invalid ticket type');
//   }

//   const selectedType = event.ticketTypes[ticketTypeIndex];

//   if (!selectedType.available || selectedType.quantity < quantity) {
//     throw new BadRequestError('Not enough tickets available');
//   }

//   // Decrease ticket count
//   event.ticketTypes[ticketTypeIndex].quantity -= quantity;
//   await event.save();

//   // Create tickets
//   const tickets = [];
//   for (let i = 0; i < quantity; i++) {
//     const ticket = new Ticket({
//       event: event._id,
//       user: userId,
//       ticketType: selectedType.name,
//       price: selectedType.price,
//     });
//     await ticket.save();
//     tickets.push(ticket);
//   }

//   res.status(StatusCodes.CREATED).json({
//     status: 'success',
//     message: 'Tickets purchased successfully',
//     tickets,
//   });
// };

const buyTicket = async (req, res) => {
  const { id: eventId } = req.params;
  const { userId, ticketType, quantity, paymentReference } = req.body;

  if (!userId || !ticketType || !quantity) {
    throw new BadRequestError(
      "Missing required fields: userId, ticketType, or quantity"
    );
  }

  const event = await Event.findById(eventId);
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  const ticketTypeIndex = event.ticketTypes.findIndex(
    (t) => t.name === ticketType
  );
  if (ticketTypeIndex === -1) {
    throw new BadRequestError("Invalid ticket type");
  }

  const selectedType = event.ticketTypes[ticketTypeIndex];

  if (!selectedType.available || selectedType.quantity < quantity) {
    throw new BadRequestError("Not enough tickets available");
  }

  // Check if ticket type is available based on dates
  const currentDate = new Date();
  if (selectedType.startDate && selectedType.endDate) {
    const startDate = new Date(selectedType.startDate);
    const endDate = new Date(selectedType.endDate);
    endDate.setHours(23, 59, 59, 999); // Set to end of day

    if (currentDate < startDate) {
      throw new BadRequestError("Tickets for this type are not yet available");
    }

    if (currentDate > endDate) {
      throw new BadRequestError("Tickets for this type have expired");
    }
  }

  // Decrease ticket count
  event.ticketTypes[ticketTypeIndex].quantity -= quantity;

  // Check for wave progression if this is a wave ticket
  const isWaveTicket =
    selectedType.name.includes("Wave") ||
    selectedType.name.includes("First") ||
    selectedType.name.includes("Second") ||
    selectedType.name.includes("Final");

  if (isWaveTicket && event.ticketTypes[ticketTypeIndex].quantity === 0) {
    // Find wave tickets
    const firstWave = event.ticketTypes.find(
      (t) => t.name === "Regular - First Wave"
    );
    const secondWave = event.ticketTypes.find(
      (t) => t.name === "Regular - Second Wave"
    );
    const finalWave = event.ticketTypes.find(
      (t) => t.name === "Regular - Final Wave"
    );

    // Activate next wave if current wave is sold out
    if (
      selectedType.name === "Regular - First Wave" &&
      secondWave &&
      secondWave.quantity > 0
    ) {
      const secondWaveIndex = event.ticketTypes.findIndex(
        (t) => t.name === "Regular - Second Wave"
      );
      event.ticketTypes[secondWaveIndex].available = true;
      event.ticketTypes[ticketTypeIndex].available = false;
      console.log("First wave sold out - activated second wave");
    } else if (
      selectedType.name === "Regular - Second Wave" &&
      finalWave &&
      finalWave.quantity > 0
    ) {
      const finalWaveIndex = event.ticketTypes.findIndex(
        (t) => t.name === "Regular - Final Wave"
      );
      event.ticketTypes[finalWaveIndex].available = true;
      event.ticketTypes[ticketTypeIndex].available = false;
      console.log("Second wave sold out - activated final wave");
    } else {
      // No more waves available, deactivate current wave
      event.ticketTypes[ticketTypeIndex].available = false;
    }
  }

  await event.save();

  // Create tickets with pending status for webhook verification
  const tickets = [];
  for (let i = 0; i < quantity; i++) {
    const ticket = new Ticket({
      event: event._id,
      user: userId,
      ticketType: selectedType.name,
      price: selectedType.price,
      paymentReference:
        paymentReference ||
        `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: paymentReference ? "pending" : "active",
      paymentStatus: paymentReference ? "pending" : "completed",
    });

    // Save ticket to generate QR code
    await ticket.save();

    // Format ticket data for response
    const ticketData = {
      _id: ticket._id,
      ticketId: ticket.ticketId,
      event: event._id,
      user: userId,
      ticketType: ticket.ticketType,
      price: ticket.price,
      qrCode: ticket.qrCode,
      purchaseDate: ticket.purchaseDate,
      status: ticket.status,
      checkedIn: ticket.checkedIn,
    };

    tickets.push(ticketData);
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
    status: "success",
    message: "Tickets purchased successfully",
    tickets,
  });
};

// Get User Tickets
const getUserTickets = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new BadRequestError("User ID is required");
  }

  const tickets = await Ticket.find({ user: userId })
    .populate("event", "title startDate endDate location coverImages")
    .sort({ purchaseDate: -1 });

  res.status(StatusCodes.OK).json({
    status: "success",
    tickets,
  });
};

// Get all events for an organizer
const getOrganizerEvents = async (req, res) => {
  const { id } = req.params;

  const events = await Event.find({ organizer: id })
    .populate("category", "name description")
    .sort("-createdAt");

  res.status(StatusCodes.OK).json({ events, count: events.length });
};

// Get single event
const getEvent = async (req, res) => {
  const { id: eventId } = req.params;

  const event = await Event.findOne({
    _id: eventId,
    organizer: req.user.userId,
  }).populate("category", "name description");

  if (!event) {
    throw new NotFoundError(`No event with id ${eventId}`);
  }

  res.status(StatusCodes.OK).json({ event });
};

// Update event
// const updateEvent = async (req, res) => {
//   const { id: eventId } = req.params;
//   const { title, description, category, startDate, endDate, location, ticketTypes, capacity, tags } = req.body;

//   const event = await Event.findOne({ _id: eventId, organizer: req.user.userId });

//   if (!event) {
//     throw new NotFoundError(`No event with id ${eventId}`);
//   }

//   // Handle image upload if present
//   if (req.file) {
//     const result = await cloudinary.uploader.upload(req.file.path, {
//       folder: 'events',
//     });
//     event.coverImage = result.secure_url;
//   }

//   // Update event fields
//   event.title = title || event.title;
//   event.description = description || event.description;
//   event.category = category || event.category;
//   event.startDate = startDate || event.startDate;
//   event.endDate = endDate || event.endDate;
//   event.location = location ? {
//     type: 'Point',
//     coordinates: [0, 0],
//     ...location,
//   } : event.location;
//   event.ticketTypes = ticketTypes ? JSON.parse(ticketTypes) : event.ticketTypes;
//   event.capacity = capacity || event.capacity;
//   event.tags = tags ? tags.split(',').map(tag => tag.trim()) : event.tags;

//   await event.save();

//   res.status(StatusCodes.OK).json({ event });
// };

// Update event
const updateEvent = async (req, res) => {
  const { id: eventId } = req.params;
  const {
    title,
    description,
    category,
    startDate,
    endDate,
    startTime,
    endTime,
    location,
    ticketTypes,
    capacity,
    tags,
    ageRestriction,
  } = req.body;

  // Find event and verify ownership
  const event = await Event.findById(eventId);

  if (!event) {
    throw new NotFoundError(`No event with id ${eventId}`);
  }

  // Check ownership (if user auth is available)
  if (req.user && event.organizer.toString() !== req.user.userId) {
    throw new UnauthorizedError("Not authorized to update this event");
  }

  // Validate required fields
  if (
    !title ||
    !description ||
    !category ||
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime ||
    !capacity
  ) {
    throw new BadRequestError("All required fields must be provided");
  }

  // Parse JSON fields if they are strings (from FormData)
  let parsedTicketTypes = ticketTypes;
  let parsedLocation = location;
  let parsedAgeRestriction = ageRestriction;

  if (typeof ticketTypes === "string") {
    parsedTicketTypes = JSON.parse(ticketTypes);
  }
  if (typeof location === "string") {
    parsedLocation = JSON.parse(location);
  }
  if (typeof ageRestriction === "string") {
    parsedAgeRestriction = JSON.parse(ageRestriction);
  }

  // Validate ticket types
  if (!parsedTicketTypes || parsedTicketTypes.length === 0) {
    throw new BadRequestError("At least one ticket type is required");
  }

  for (const ticket of parsedTicketTypes) {
    if (!ticket.name || !ticket.price || !ticket.quantity) {
      throw new BadRequestError(
        "All ticket fields (name, price, quantity) are required"
      );
    }
    if (ticket.price <= 0 || ticket.quantity <= 0) {
      throw new BadRequestError(
        "Ticket price and quantity must be greater than 0"
      );
    }
  }

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    throw new BadRequestError("End date must be after start date");
  }

  // Handle image upload if present
  if (req.file) {
    event.coverImage = req.file.filename;
  }

  // Process ticket types with dates
  const processedTicketTypes = parsedTicketTypes.map((ticket) => ({
    name: ticket.name,
    price: parseFloat(ticket.price),
    quantity: parseInt(ticket.quantity),
    description: ticket.description || "",
    available: ticket.available !== undefined ? ticket.available : true,
    startDate: ticket.startDate ? new Date(ticket.startDate) : null,
    endDate: ticket.endDate ? new Date(ticket.endDate) : null,
  }));

  // Update event fields
  event.title = title;
  event.description = description;
  event.category = category;
  event.startDate = startDate;
  event.endDate = endDate;
  event.startTime = startTime;
  event.endTime = endTime;
  event.location = {
    type: "Point",
    coordinates: parsedLocation?.coordinates || [0, 0],
    address: parsedLocation?.address || "",
    city: parsedLocation?.city || "",
    country: parsedLocation?.country || "",
  };
  event.ticketTypes = processedTicketTypes;
  event.capacity = parseInt(capacity);
  event.tags = Array.isArray(tags)
    ? tags
    : tags
    ? tags.split(",").map((tag) => tag.trim())
    : [];

  // Handle age restriction
  if (parsedAgeRestriction && parsedAgeRestriction.hasRestriction) {
    event.ageRestriction = {
      hasRestriction: true,
      minAge: parsedAgeRestriction.minAge
        ? parseInt(parsedAgeRestriction.minAge)
        : undefined,
      maxAge: parsedAgeRestriction.maxAge
        ? parseInt(parsedAgeRestriction.maxAge)
        : undefined,
    };
  } else {
    event.ageRestriction = { hasRestriction: false };
  }

  event.updatedAt = new Date();
  await event.save();

  // Populate category for response
  await event.populate("category", "name description");

  res.status(StatusCodes.OK).json({
    success: true,
    status: "success",
    message: "Event updated successfully",
    data: event,
  });
};

// Delete an event
const deleteEvent = async (req, res) => {
  const { id: eventId } = req.params;

  const event = await Event.findOne({ _id: eventId });

  if (!event) {
    throw new NotFoundError(`No event with id: ${eventId}`);
  }

  // In a real-world scenario, you might want to add more checks here.
  // For example, ensuring that only the event organizer or an admin can delete it.
  // await checkPermissions(req.user, event.organizer);

  await Event.deleteOne({ _id: eventId });

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Event deleted successfully",
  });
};

// Get all events with filtering, sorting, and pagination
// const getAllEvents = async (req, res) => {
//   try {
//     const {
//       category,
//       status,
//       startDate,
//       endDate,
//       city,
//       country,
//       sort = '-createdAt',
//       page = 1,
//       limit = 10
//     } = req.query;

//     // Build query
//     const query = {};
//     if (category) query.category = category;
//     if (status) query.status = status;
//     if (startDate) query.startDate = { $gte: new Date(startDate) };
//     if (endDate) query.endDate = { $lte: new Date(endDate) };
//     if (city) query['location.city'] = city;
//     if (country) query['location.country'] = country;

//     // Execute query with pagination
//     const events = await Event.find(query)
//       .populate('organizer', 'firstName lastName email')
//       .populate('category', 'name description')
//       .sort(sort)
//       .skip((page - 1) * limit)
//       .limit(parseInt(limit));

//     // Get total count for pagination
//     const total = await Event.countDocuments(query);

//     res.status(StatusCodes.OK).json({
//       status: 'success',
//       data: events,
//       pagination: {
//         total,
//         page: parseInt(page),
//         pages: Math.ceil(total / limit)
//       }
//     });
//   } catch (error) {
//     console.error('Error fetching events:', error);
//     res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
//       status: 'error',
//       message: 'Failed to fetch events'
//     });
//   }
// };

// Get all events with filtering, sorting, and pagination
const getAllEvents = async (req, res) => {
  try {
    const {
      category,
      status,
      startDate,
      endDate,
      city,
      country,
      sort = "-createdAt",
      page = 1,
      limit = 10,
      bannerStatus,
      isPublic,
    } = req.query;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (bannerStatus !== undefined)
      query.bannerStatus = bannerStatus === "true";
    if (isPublic !== undefined) query.isPublic = isPublic === "true";
    if (startDate) query.startDate = { $gte: new Date(startDate) };
    if (endDate) query.endDate = { $lte: new Date(endDate) };
    if (city) query["location.city"] = city;
    if (country) query["location.country"] = country;

    // Execute query with pagination
    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .populate("category", "name description")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get organizer registrations for all organizers
    const OrganizerRegistration = require("../models/OrganizerRegistration");
    const organizerIds = events
      .map((event) => event.organizer?._id)
      .filter(Boolean);
    const organizerRegistrations = await OrganizerRegistration.find({
      userId: { $in: organizerIds },
    }).select("userId organization");

    // Create a map for quick lookup
    const orgMap = {};
    organizerRegistrations.forEach((reg) => {
      orgMap[reg.userId.toString()] = reg.organization;
    });

    // Add organization data to events
    const eventsWithOrganization = events.map((event) => {
      const eventObj = event.toObject();
      if (eventObj.organizer) {
        eventObj.organizer.organization =
          orgMap[eventObj.organizer._id.toString()] || null;
      }
      return eventObj;
    });

    // Get total count for pagination
    const total = await Event.countDocuments(query);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: eventsWithOrganization,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch events",
    });
  }
};

// Get public events

const getPublicEvents = async (req, res) => {
  try {
    // Match events that are published AND (isPublic is true OR isPublic is missing/null)
    // Since default is true, missing field implies public
    const events = await Event.find({
      status: "published",
      //below line added to handle isPublic filtering first it checks if isPublic is true then checks if isPublic field is missing or null then it includes those events as well
      $or: [
        { isPublic: true },
        { isPublic: { $exists: false } },
        { isPublic: null },
      ],
    })
      .populate("category", "name description")
      .populate("organizer", "firstName lastName email") // Added organizer population for consistency
      .sort("-createdAt"); // Sort by newest first

    res.status(StatusCodes.OK).json({
      status: "success",
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error("Error fetching public events:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Failed to fetch public events" });
  }
};

// Publish event
const publishEvent = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  // console.log('Publishing event:', { id, status });

  const event = await Event.findById(id);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  console.log("Found event:", {
    id: event._id,
    title: event.title,
    organizer: event.organizer,
    currentStatus: event.status,
    newStatus: status,
  });

  // Update status
  event.status = status;
  await event.save();
  // console.log('Event updated successfully');

  // Emit notification
  const notification = await Notification.create({
    userId: event.organizer,
    type: "event_status_change",
    message: `Event \"${event.title}\" status changed to ${event.status}.`,
    eventId: event._id,
    eventTitle: event.title,
    status: event.status,
    read: false,
  });
  console.log("Notification created:", notification._id);

  // Emit socket event
  const io = req.app.get("io");
  if (io) {
    const roomName = `organizer_${event.organizer}`;
    console.log("Emitting to room:", roomName);
    io.to(roomName).emit("eventStatusUpdated", {
      eventId: event._id,
      eventTitle: event.title,
      status: event.status,
    });
    console.log("Socket event emitted");
  } else {
    console.log("Socket.IO not available");
  }

  res.status(200).json({
    status: "success",
    data: event,
  });
};

// Cancel event
const cancelEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);

  console.log("Cancelling event:", { id: req.params.id });

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  console.log("Found event:", {
    id: event._id,
    title: event.title,
    organizer: event.organizer,
    currentStatus: event.status,
  });

  if (event.organizer.toString() !== req.user.id && req.user.role !== "admin") {
    throw new BadRequestError("Not authorized to cancel this event");
  }

  event.status = "cancelled";
  await event.save();
  console.log("Event cancelled successfully");

  // Emit notification
  const notification = await Notification.create({
    userId: event.organizer,
    type: "event_status_change",
    message: `Event \"${event.title}\" status changed to cancelled.`,
    eventId: event._id,
    eventTitle: event.title,
    status: "cancelled",
    read: false,
  });
  console.log("Notification created:", notification._id);

  // Emit socket event
  const io = req.app.get("io");
  if (io) {
    const roomName = `organizer_${event.organizer}`;
    console.log("Emitting to room:", roomName);
    io.to(roomName).emit("eventStatusUpdated", {
      eventId: event._id,
      eventTitle: event.title,
      status: "cancelled",
    });
    console.log("Socket event emitted");
  } else {
    console.log("Socket.IO not available");
  }

  res.status(200).json({
    status: "success",
    data: event,
  });
};

// Update ticket types
const updateTicketTypes = async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  if (event.organizer.toString() !== req.user.id && req.user.role !== "admin") {
    throw new BadRequestError(
      "Not authorized to update tickets for this event"
    );
  }

  // Validate ticket types
  const { ticketTypes } = req.body;
  if (!Array.isArray(ticketTypes)) {
    throw new BadRequestError("Ticket types must be an array");
  }

  // Update ticket types
  event.ticketTypes = ticketTypes;
  await event.save();

  res.status(200).json({
    status: "success",
    data: event,
  });
};

// Get event details
const getEventDetails = async (req, res) => {
  const { id } = req.params;

  try {
    console.log("Fetching event with ID:", id);
    const event = await Event.findById(id)
      .populate("organizer", "name email")
      .populate("category", "name description")
      .select("-__v"); // Exclude version field

    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // // console.log('Found event:', {
    //   title: event.title,
    //   ticketTypes: event.ticketTypes,
    //   category: event.category
    // });

    // Format dates for frontend
    const formattedEvent = {
      ...event.toObject(),
      startDate: event.startDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      location: {
        ...event.location,
        coordinates: event.location.coordinates || [0, 0],
      },
      ticketTypes: event.ticketTypes.map((ticket) => ({
        name: ticket.name,
        price: ticket.price,
        quantity: ticket.quantity,
        description: ticket.description || "",
        available: ticket.available !== false,
        startDate: ticket.startDate
          ? new Date(ticket.startDate).toISOString()
          : null, // Format startDate if available
        endDate: ticket.endDate ? new Date(ticket.endDate).toISOString() : null, // Format endDate if available
      })),
    };

    console.log("Formatted event:", {
      title: formattedEvent.title,
      ticketTypes: formattedEvent.ticketTypes,
      category: formattedEvent.category,
    });

    res.status(200).json({
      status: "success",
      data: formattedEvent,
    });
  } catch (error) {
    console.error("Error in getEventDetails:", error);
    if (error.name === "CastError") {
      throw new NotFoundError("Invalid event ID");
    }
    throw error;
  }
};

const getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID format" });
    }

    const wishlistItems = await Wishlist.find({ userId })
      .populate({
        path: "eventId",
        select:
          "title startDate endDate location category coverImage ticketTypes",
      })
      .sort({ createdAt: -1 });

    const formattedItems = wishlistItems.map((item) => ({
      _id: item._id,
      userId: item.userId,
      eventId: item.eventId?._id || item.eventId,
      event: item.eventId,
      createdAt: item.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedItems,
      message: "Wishlist retrieved successfully",
    });
  } catch (error) {
    console.error("Detailed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve wishlist",
      error: error.message,
    });
  }
};

/**
 * Update user's wishlist (add or remove items)
 * @route POST /api/events/:userId/wishlist
 */
const updateWishlist = async (req, res) => {
  const { userId } = req.params;
  const { eventId } = req.body;

  try {
    // Check if the wishlist entry exists
    const existing = await Wishlist.findOne({ userId, eventId });

    if (existing) {
      // Remove from wishlist
      await Wishlist.deleteOne({ _id: existing._id });
      return res
        .status(200)
        .json({ success: true, message: "Removed from wishlist" });
    } else {
      // Add to wishlist
      await Wishlist.create({ userId, eventId });
      return res
        .status(201)
        .json({ success: true, message: "Added to wishlist" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const toggleBannerStatus = async (req, res) => {
  const { id: eventId } = req.params;
  const { bannerStatus } = req.body;

  if (typeof bannerStatus !== "boolean") {
    throw new BadRequestError("Banner status must be a boolean value");
  }

  const event = await Event.findByIdAndUpdate(
    eventId,
    { bannerStatus },
    { new: true, runValidators: true }
  );

  if (!event) {
    throw new NotFoundError(`No event with id ${eventId}`);
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: { event },
  });
};

// Update ticket availability manually
const updateTicketAvailability = async (req, res) => {
  const { updateTicketAvailability } = require("../utils/ticketScheduler");

  try {
    const result = await updateTicketAvailability();

    res.status(StatusCodes.OK).json({
      status: "success",
      message: `Ticket availability updated for ${result.updatedEvents} events`,
      data: result,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to update ticket availability",
      error: error.message,
    });
  }
};

// Make sure to export all controller functions
module.exports = {
  createEvent,
  getOrganizerEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  publishEvent,
  cancelEvent,
  updateTicketTypes,
  getEventDetails,
  buyTicket,
  getPublicEvents,
  getUserTickets,
  getWishlist,
  updateWishlist,
  toggleBannerStatus,
  updateTicketAvailability,
};
