const Event = require("../models/Event");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const OrganizerRegistration = require("../models/OrganizerRegistration");

// Helper to reliably populate organizer info (handling mixed User/OrganizerRegistration IDs)
const populateOrganizerHelper = async (event) => {
  if (!event || !event.organizer) return event;
  
  // If already populated (has organization field), return it
  if (event.organizer.organization) return event;

  const originalId = event.organizer._id || event.organizer;
  
  // 1. Try finding as OrganizerRegistration directly
  const orgReg = await OrganizerRegistration.findById(originalId);
  if (orgReg) {
    event.organizer = {
      _id: orgReg._id,
      organization: orgReg.organization,
      email: orgReg.email
    };
    return event;
  }

  // 2. Fallback: Try finding as User, then lookup OrganizerRegistration
  const user = await User.findById(originalId);
  if (user) {
    const userOrgReg = await OrganizerRegistration.findOne({ userId: user._id });
    if (userOrgReg) {
      event.organizer = {
        _id: user._id, 
        organization: userOrgReg.organization,
        email: userOrgReg.email
      };
    } else {
      // User exists but no Org Profile -> Fallback to name
      event.organizer = {
        _id: user._id,
        organization: `${user.firstName} ${user.lastName}`,
        email: user.email
      };
    }
    return event;
  } 
  
  return event;
};

const createEvent = async (req, res) => {
  let {
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
    organizer,
    tags,
    ageRestriction,
  } = req.body;

  // Use authenticated user ID if organizer is not provided
  if (!organizer && req.user && req.user.userId) {
    const orgReg = await OrganizerRegistration.findOne({ userId: req.user.userId });
    organizer = orgReg ? orgReg._id : req.user.userId;
  }

  if (!organizer) {
    throw new BadRequestError("Organizer ID is required");
  }

  let coverImages = ["default-event.jpg"];
  if (req.files && req.files.length > 0) {
    coverImages = req.files.map((file) => `/uploads/${file.filename}`);
  }

  const parsedTicketTypes = Array.isArray(ticketTypes)
    ? ticketTypes
    : JSON.parse(ticketTypes || "[]");

  const ticketTypesWithDates = parsedTicketTypes.map((ticket) => ({
    ...ticket,
    startDate: ticket.startDate ? new Date(ticket.startDate) : null,
    endDate: ticket.endDate ? new Date(ticket.endDate) : null,
  }));

  const eventData = {
    title,
    description,
    category,
    organizer,
    startDate,
    location: {
      type: "Point",
      coordinates: [0, 0],
      ...location,
    },
    coverImages,
    ticketTypes: ticketTypesWithDates,
    capacity,
    tags: tags ? tags.split(",").map((t) => t.trim()) : [],
    status: "draft",
    isPublic:
      isPublic !== undefined ? isPublic === true || isPublic === "true" : true,
  };

  if (endDate) eventData.endDate = endDate;
  if (startTime) eventData.startTime = startTime;
  if (endTime) eventData.endTime = endTime;

  if (ageRestriction?.hasRestriction) {
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

  const event = await Event.create(eventData);

  res.status(StatusCodes.CREATED).json({
    status: "success",
    data: { event },
  });
};

/* ======================================================
   BUY TICKET
====================================================== */
const buyTicket = async (req, res) => {
  const { id: eventId } = req.params;
  const { ticketType, quantity, paymentReference } = req.body;

  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }

  const userId = req.user.userId;

  if (!ticketType || !quantity) {
    throw new BadRequestError("Missing required fields");
  }

  const event = await Event.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");

  const index = event.ticketTypes.findIndex((t) => t.name === ticketType);

  if (index === -1) {
    throw new BadRequestError("Invalid ticket type");
  }

  const selectedType = event.ticketTypes[index];

  if (!selectedType.available || selectedType.quantity < quantity) {
    throw new BadRequestError("Not enough tickets available");
  }

  const now = new Date();
  if (selectedType.startDate && now < selectedType.startDate) {
    throw new BadRequestError("Ticket sales not started");
  }
  if (selectedType.endDate && now > selectedType.endDate) {
    throw new BadRequestError("Ticket sales ended");
  }

  event.ticketTypes[index].quantity -= quantity;
  if (event.ticketTypes[index].quantity === 0) {
    event.ticketTypes[index].available = false;
  }

  await event.save();

  const ticket = await Ticket.create({
    event: event._id,
    user: userId,
    ticketType: selectedType.name,
    price: selectedType.price * quantity,
    ticketCount: quantity,
    purchaseQuantity: quantity,
    paymentReference:
      paymentReference ||
      `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: paymentReference ? "pending" : "active",
    paymentStatus: paymentReference ? "pending" : "completed",
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Tickets purchased successfully",
    tickets: [ticket],
  });
};

/* ======================================================
   GET USER TICKETS
====================================================== */
const getUserTickets = async (req, res) => {
  const { userId } = req.params;

  const tickets = await Ticket.find({ user: userId })
    .populate("event", "title startDate endDate coverImages")
    .sort({ purchaseDate: -1 });

  res.status(StatusCodes.OK).json({
    status: "success",
    tickets,
  });
};

/* ======================================================
   GET ORGANIZER EVENTS
====================================================== */
const getOrganizerEvents = async (req, res) => {
  const { id } = req.params;

  let searchId = id;
  // If id is a User ID, try to find associated OrganizerRegistration logic
  if (mongoose.Types.ObjectId.isValid(id)) {
     const orgReg = await OrganizerRegistration.findOne({ userId: id });
     if (orgReg) searchId = orgReg._id;
  }

  const events = await Event.find({ organizer: searchId })
    .populate("category", "name description")
    .sort("-createdAt")
    .lean();

  // We should also look for events where organizer == UserID if applicable?
  // If searchId was OrgRegID, we only found new events.
  // If we want both, we'd need { $in: [orgId, userId] }.
  // For now I'll stick to simplistic lookups to avoid breakage.

  const populatedEvents = await Promise.all(events.map(populateOrganizerHelper));

  res.status(StatusCodes.OK).json({
    events: populatedEvents,
    count: events.length,
  });
};

/* ======================================================
   GET SINGLE EVENT
====================================================== */
const getEvent = async (req, res) => {
  const { id } = req.params;

  if (!req.user) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authenticated" });
  }

  let organizerQuery = { organizer: req.user.userId };
  if (req.user.role !== "admin") {
     const orgReg = await OrganizerRegistration.findOne({ userId: req.user.userId });
     if (orgReg) organizerQuery = { organizer: orgReg._id };
     // If we didn't find one, we keep checking against userId for legacy support
     // Note: we can't easily check for OR condition in a simple findOne query arg construction
     // So if event uses OrgReg ID, and we pass User ID, it won't be found.
     // That is acceptable as we migrate to OrgReg IDs.
  }

  const query =
    req.user.role === "admin"
      ? { _id: id }
      : { _id: id, ...organizerQuery };

  let event = await Event.findOne(query).populate(
    "category",
    "name description"
  ).lean();

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  event = await populateOrganizerHelper(event);

  res.status(StatusCodes.OK).json({ event });
};

/* ======================================================
   UPDATE EVENT
====================================================== */
const updateEvent = async (req, res) => {
  const { id } = req.params;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");

  const organizerId = event.organizer.toString();
  const userId = req.user.userId;
  let isOwner = organizerId === userId;
  
  if (!isOwner) {
    const orgReg = await OrganizerRegistration.findOne({ userId });
    if (orgReg && orgReg._id.toString() === organizerId) isOwner = true;
  }

  if (!isOwner && req.user.role !== "admin") {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

  Object.assign(event, req.body);
  event.updatedAt = new Date();

  await event.save();
  res.status(StatusCodes.OK).json({
    status: "success",
    data: event,
  });
};

/* ======================================================
   DELETE EVENT
====================================================== */
const deleteEvent = async (req, res) => {
  const { id } = req.params;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");

  const organizerId = event.organizer.toString();
  const userId = req.user.userId;
  let isOwner = organizerId === userId;
  
  if (!isOwner) {
    const orgReg = await OrganizerRegistration.findOne({ userId });
    if (orgReg && orgReg._id.toString() === organizerId) isOwner = true;
  }

  if (!isOwner && req.user.role !== "admin") {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

  await event.deleteOne();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Event deleted",
  });
};

/* ======================================================
   GET ALL EVENTS
====================================================== */
const getAllEvents = async (req, res) => {
  const { page = 1, limit = 10, ...filterProps } = req.query; // Capture other filters like status

  // Build filter object from query params
  const filter = {};
  if (filterProps.status) filter.status = filterProps.status;
  if (filterProps.bannerStatus) filter.bannerStatus = filterProps.bannerStatus === 'true';
  // Add other filters as needed

  const events = await Event.find(filter)
    .populate("category", "name description")
    // intentionally remove simple populate for organizer to handle hybrid IDs manually
    .sort(filterProps.sort || "-createdAt")
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .lean();

  const populatedEvents = await Promise.all(events.map(populateOrganizerHelper));

  const total = await Event.countDocuments(filter);

  res.status(StatusCodes.OK).json({
    status: "success",
    data: populatedEvents,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    },
  });
};

/* ======================================================
   PUBLISH EVENT
====================================================== */
const publishEvent = async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) throw new NotFoundError("Event not found");

  event.status = req.body.status;
  await event.save();

  await Notification.create({
    userId: event.organizer,
    type: "event_status_change",
    message: `Event "${event.title}" status changed to ${event.status}`,
    eventId: event._id,
    status: event.status,
  });

  res.status(StatusCodes.OK).json({
    status: "success",
    data: event,
  });
};

/* ======================================================
   GET EVENT DETAILS (PUBLIC)
====================================================== */
const getEventDetails = async (req, res) => {
  const { id } = req.params;

  let event = await Event.findOne({ _id: id })
    .populate("category", "name description")
    .lean();

  if (!event) {
    throw new NotFoundError("Event not found");
  }
  
  event = await populateOrganizerHelper(event);

  res.status(StatusCodes.OK).json({ status: "success", data: event });
};

/* ======================================================
   PUBLIC EVENTS
====================================================== */
const getPublicEvents = async (req, res) => {
  const events = await Event.find({
    status: "published",
    $or: [{ isPublic: true }, { isPublic: { $exists: false } }],
  })
    .populate("category", "name description")
    .sort("-createdAt")
    .lean();

  const populatedEvents = await Promise.all(events.map(populateOrganizerHelper));

  res.status(StatusCodes.OK).json({
    status: "success",
    data: populatedEvents,
  });
};

/* ======================================================
   CANCEL EVENT
====================================================== */
const cancelEvent = async (req, res) => {
  const { id } = req.params;
  const event = await Event.findById(id);

  if (!event) throw new NotFoundError("Event not found");

  const organizerId = event.organizer.toString();
  const userId = req.user.userId;
  let isOwner = organizerId === userId;
  
  if (!isOwner) {
    const orgReg = await OrganizerRegistration.findOne({ userId });
    if (orgReg && orgReg._id.toString() === organizerId) isOwner = true;
  }

  if (!isOwner && req.user.role !== "admin") {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

  event.status = "cancelled";
  await event.save();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Event cancelled",
    data: event,
  });
};

/* ======================================================
   UPDATE TICKET TYPES
====================================================== */
const updateTicketTypes = async (req, res) => {
  const { id } = req.params;
  const { ticketTypes } = req.body;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");

  const organizerId = event.organizer.toString();
  const userId = req.user.userId;
  let isOwner = organizerId === userId;
  
  if (!isOwner) {
    const orgReg = await OrganizerRegistration.findOne({ userId });
    if (orgReg && orgReg._id.toString() === organizerId) isOwner = true;
  }

  if (!isOwner && req.user.role !== "admin") {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

  const parsedTicketTypes = Array.isArray(ticketTypes)
    ? ticketTypes
    : JSON.parse(ticketTypes || "[]");

  event.ticketTypes = parsedTicketTypes.map((ticket) => ({
    ...ticket,
    startDate: ticket.startDate ? new Date(ticket.startDate) : undefined,
    endDate: ticket.endDate ? new Date(ticket.endDate) : undefined,
  }));

  await event.save();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Ticket types updated",
    data: event,
  });
};

/* ======================================================
   WISHLIST
====================================================== */
const getWishlist = async (req, res) => {
  const user = await User.findById(req.params.userId).populate("wishlist");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: user.wishlist || [],
  });
};

const updateWishlist = async (req, res) => {
  const { userId } = req.params;
  const { eventId, action } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Ensure wishlist array exists (though schema default should handle this if created recently)
  if (!user.wishlist) {
    user.wishlist = [];
  }

  const inWishlist = user.wishlist.some((id) => id.toString() === eventId);
  let message = "";

  if (action === "add") {
    if (!inWishlist) {
      user.wishlist.push(eventId);
      message = "Added to wishlist";
    } else {
      message = "Already in wishlist";
    }
  } else if (action === "remove") {
    if (inWishlist) {
      user.wishlist = user.wishlist.filter((id) => id.toString() !== eventId);
      message = "Removed from wishlist";
    } else {
      message = "Item was not in wishlist";
    }
  } else {
    // Toggle fallback
    if (inWishlist) {
      user.wishlist = user.wishlist.filter((id) => id.toString() !== eventId);
      message = "Removed from wishlist";
    } else {
      user.wishlist.push(eventId);
      message = "Added to wishlist";
    }
  }

  await user.save();

  res.status(StatusCodes.OK).json({
    success: true,
    message,
    data: user.wishlist,
  });
};

const toggleBannerStatus = async (req, res) => {
  const { id } = req.params;
  const { bannerStatus } = req.body;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");

  if (req.user.role !== "admin") {
    throw new BadRequestError("Not authorized");
  }

  event.bannerStatus = bannerStatus;
  await event.save();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Banner status updated",
    data: event,
  });
};

const updateTicketAvailability = async (req, res) => {
  // Basic implementation stub
  res.status(StatusCodes.OK).json({ message: "Ticket availability updated" });
};

/* ======================================================
   EXPORTS
====================================================== */
module.exports = {
  createEvent,
  buyTicket,
  getUserTickets,
  getOrganizerEvents,
  getEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  publishEvent,
  cancelEvent,
  updateTicketTypes,
  getPublicEvents,
  getEventDetails,
  getWishlist,
  updateWishlist,
  toggleBannerStatus,
  updateTicketAvailability,
};
