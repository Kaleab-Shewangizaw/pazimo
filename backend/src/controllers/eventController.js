const Event = require("../models/Event");
const Wishlist = require("../models/Wishlist");
const { StatusCodes } = require("http-status-codes");
const {
  BadRequestError,
  NotFoundError,
} = require("../errors");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");


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
    ageRestriction,
  } = req.body;

  if (!req.user || !req.user.userId) {
    throw new BadRequestError("User not authenticated");
  }

  const organizer = req.user.userId;

  let coverImages = ["default-event.jpg"];
  if (req.files && req.files.length > 0) {
    coverImages = req.files.map(
      (file) => `/uploads/${file.filename}`
    );
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
      isPublic !== undefined
        ? isPublic === true || isPublic === "true"
        : true,
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

  const index = event.ticketTypes.findIndex(
    (t) => t.name === ticketType
  );

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
      `TXN-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    status: paymentReference ? "pending" : "active",
    paymentStatus: paymentReference
      ? "pending"
      : "completed",
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

  const events = await Event.find({ organizer: id })
    .populate("category", "name description")
    .sort("-createdAt");

  res.status(StatusCodes.OK).json({
    events,
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

  const query =
    req.user.role === "admin"
      ? { _id: id }
      : { _id: id, organizer: req.user.userId };

  const event = await Event.findOne(query).populate(
    "category",
    "name description"
  );

  if (!event) {
    throw new NotFoundError("Event not found");
  }

  res.status(StatusCodes.OK).json({ event });
};

/* ======================================================
   UPDATE EVENT
====================================================== */
const updateEvent = async (req, res) => {
  const { id } = req.params;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");

  if (
    event.organizer.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
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

  if (
    event.organizer.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
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
  const { page = 1, limit = 10 } = req.query;

  const events = await Event.find()
    .populate("category", "name description")
    .populate("organizer", "firstName lastName email")
    .sort("-createdAt")
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Event.countDocuments();

  res.status(StatusCodes.OK).json({
    status: "success",
    data: events,
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
   PUBLIC EVENTS
====================================================== */
const getPublicEvents = async (req, res) => {
  const events = await Event.find({
    status: "published",
    $or: [
      { isPublic: true },
      { isPublic: { $exists: false } },
    ],
  })
    .populate("category", "name description")
    .populate("organizer", "firstName lastName email")
    .sort("-createdAt");

  res.status(StatusCodes.OK).json({
    status: "success",
    data: events,
  });
};

/* ======================================================
   WISHLIST
====================================================== */
const getWishlist = async (req, res) => {
  const items = await Wishlist.find({
    userId: req.params.userId,
  }).populate("eventId");

  res.status(StatusCodes.OK).json({
    status: "success",
    data: items,
  });
};

const updateWishlist = async (req, res) => {
  const { userId } = req.params;
  const { eventId } = req.body;

  const exists = await Wishlist.findOne({ userId, eventId });

  if (exists) {
    await exists.deleteOne();
    return res.json({ message: "Removed from wishlist" });
  }

  await Wishlist.create({ userId, eventId });
  res.status(201).json({ message: "Added to wishlist" });
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
  getPublicEvents,
  getWishlist,
  updateWishlist,
};