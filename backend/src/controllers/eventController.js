const Event = require("../models/Event");
const User = require("../models/User");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { applyTicketAvailabilityRules } = require("../utils/ticketAvailability");
const {
  generateShortId,
  slugify,
} = require("../utils/eventUrl");

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return fallback;
};

const toNumberOrUndefined = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDateOrUndefined = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const detectWaveOrderFromName = (name) => {
  const lowered = (name || "").toLowerCase();
  if (lowered.includes("first wave")) return 1;
  if (lowered.includes("second wave")) return 2;
  if (lowered.includes("third wave")) return 3;
  if (lowered.includes("final wave")) return 99;
  return undefined;
};

const normalizeWaveSwitchMode = (value) => {
  const lowered = (value || "").toLowerCase();
  if (lowered === "by_time") return "date";
  if (lowered === "by_sold_out") return "quantity";
  if (lowered === "by_time_or_sold_out") return "date_or_quantity";
  if (["date", "quantity", "date_or_quantity"].includes(lowered)) {
    return lowered;
  }
  return "date";
};

const parseBracketTicketTypes = (body) => {
  const ticketsByIndex = {};

  Object.entries(body || {}).forEach(([key, value]) => {
    const match = key.match(/^ticketTypes\[(\d+)\]\[(.+)\]$/);
    if (!match) return;

    const index = Number(match[1]);
    const field = match[2];
    if (!ticketsByIndex[index]) {
      ticketsByIndex[index] = {};
    }

    ticketsByIndex[index][field] = value;
  });

  const orderedIndexes = Object.keys(ticketsByIndex)
    .map((index) => Number(index))
    .sort((a, b) => a - b);

  return orderedIndexes.map((index) => ticketsByIndex[index]);
};

const parseTicketTypesInput = (ticketTypes, reqBody) => {
  if (Array.isArray(ticketTypes)) return ticketTypes;

  if (ticketTypes && typeof ticketTypes === "object") {
    const values = Object.keys(ticketTypes)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ticketTypes[key]);

    if (values.length > 0) return values;
  }

  if (typeof ticketTypes === "string") {
    try {
      const parsed = JSON.parse(ticketTypes);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      // Fall back to bracket parsing below.
    }
  }

  const bracketParsed = parseBracketTicketTypes(reqBody);
  if (bracketParsed.length > 0) return bracketParsed;
  return [];
};

const normalizeTicketTypes = (rawTickets = []) =>
  rawTickets.map((ticket) => {
    const priceETB = toNumberOrUndefined(ticket.priceETB);
    const priceUSD = toNumberOrUndefined(ticket.priceUSD);
    const price =
      toNumberOrUndefined(ticket.price) ??
      (priceETB !== undefined ? priceETB : priceUSD !== undefined ? priceUSD : 0);

    const quantity = toNumberOrUndefined(ticket.quantity) ?? 0;
    const startDate = toDateOrUndefined(ticket.startDate || ticket.saleStartDate);
    const endDate = toDateOrUndefined(ticket.endDate || ticket.saleEndDate);
    const inferredWaveOrder = detectWaveOrderFromName(ticket.name);
    const waveOrder = toNumberOrUndefined(ticket.waveOrder) ?? inferredWaveOrder;
    const waveSwitchMode = normalizeWaveSwitchMode(
      ticket.waveSwitchMode || ticket.waveActivationType
    );
    const hasWaveMetadata =
      !!ticket.waveGroup || waveOrder !== undefined || /wave/i.test(ticket.name || "");

    return {
      name: ticket.name,
      price,
      priceETB,
      priceUSD,
      quantity,
      description: ticket.description,
      available: toBoolean(ticket.available, true),
      ...(typeof ticket.manualDisabled === "boolean"
        ? { manualDisabled: ticket.manualDisabled }
        : {}),
      startDate,
      endDate,
      ...(ticket.waveGroup ? { waveGroup: ticket.waveGroup } : {}),
      ...(waveOrder !== undefined ? { waveOrder } : {}),
      ...(hasWaveMetadata ? { waveSwitchMode } : {}),
    };
  });

const createTicketTypeKey = (ticket = {}) => {
  const name = String(ticket.name || "").trim().toLowerCase();
  const waveGroup = String(ticket.waveGroup || "").trim().toLowerCase();
  const waveOrder =
    ticket.waveOrder === undefined || ticket.waveOrder === null
      ? ""
      : String(ticket.waveOrder);
  return `${name}::${waveGroup}::${waveOrder}`;
};

const ensureEventUrlFields = async (event) => {
  if (!event) return event;

  let changed = false;

  if (!event.slug && event.title) {
    event.slug = slugify(event.title);
    changed = true;
  }

  if (!event.shortId) {
    let shortId;
    let attempts = 0;

    while (!shortId && attempts < 20) {
      attempts += 1;
      const candidate = await generateShortId();
      const existing = await Event.exists({ shortId: candidate });
      if (!existing) {
        shortId = candidate;
      }
    }

    if (!shortId) {
      throw new Error("Failed to generate a unique event short ID");
    }

    event.shortId = shortId;
    changed = true;
  }

  if (changed) {
    await event.save();
  }

  return event;
};

// Preserve and infer manual disable intent from admin edits.
const applyManualAvailabilityOverrides = (
  existingTicketTypes = [],
  nextTicketTypes = []
) => {
  const existingByKey = new Map(
    (existingTicketTypes || []).map((ticket) => [
      createTicketTypeKey(ticket),
      ticket,
    ])
  );

  return (nextTicketTypes || []).map((ticket) => {
    const existing = existingByKey.get(createTicketTypeKey(ticket));

    let manualDisabled = Boolean(existing?.manualDisabled);

    if (typeof ticket.manualDisabled === "boolean") {
      manualDisabled = ticket.manualDisabled;
    } else if (
      existing &&
      typeof existing.available === "boolean" &&
      typeof ticket.available === "boolean" &&
      existing.available !== ticket.available
    ) {
      // If admin flipped availability, persist that intent.
      manualDisabled = ticket.available === false;
    }

    return {
      ...ticket,
      manualDisabled,
      // Keep payload coherent; rules will still enforce windows/quantity for enabled tickets.
      available: manualDisabled ? false : ticket.available,
    };
  });
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
    organizer = req.user.userId;
  }

  if (!organizer) {
    throw new BadRequestError("Organizer ID is required");
  }

  let coverImages = ["default-event.jpg"];
  if (req.files && req.files.length > 0) {
    coverImages = req.files.map((file) => `/uploads/${file.filename}`);
  }

  const parsedTicketTypes = parseTicketTypesInput(ticketTypes, req.body);
  const ticketTypesWithDates = normalizeTicketTypes(parsedTicketTypes);

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

  if (applyTicketAvailabilityRules(event).changed) {
    await event.save();
  }

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

  const now = new Date();
  const { changed: prePurchaseUpdated } = applyTicketAvailabilityRules(event, now);
  if (prePurchaseUpdated) {
    await event.save();
  }

  const index = event.ticketTypes.findIndex((t) => t.name === ticketType);

  if (index === -1) {
    throw new BadRequestError("Invalid ticket type");
  }

  const selectedType = event.ticketTypes[index];

  if (!selectedType.available || selectedType.quantity < quantity) {
    throw new BadRequestError("Not enough tickets available");
  }

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

  applyTicketAvailabilityRules(event, now);

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
   GET ORGANIZER EVENTS (OPTIMIZED)
====================================================== */
const getOrganizerEvents = async (req, res) => {
  const { id } = req.params;
  const includeTickets = req.query.includeTickets === 'true';

  // Use lean() for better performance since we're just reading data
  const events = await Event.find({ organizer: id })
    .populate("category", "name description")
    .select("-__v") // Exclude version key
    .sort("-createdAt")
    ;

  await Promise.all(events.map((event) => ensureEventUrlFields(event)));

  // Optionally include tickets if requested
  if (includeTickets && events.length > 0) {
    const eventIds = events.map(e => e._id);
    
    // Fetch tickets for all events in one query
    const tickets = await Ticket.find({ event: { $in: eventIds } })
      .select('event price purchaseQuantity ticketCount isInvitation status paymentStatus')
      .lean();
    
    // Group tickets by event
    const ticketsByEvent = tickets.reduce((acc, ticket) => {
      const eventId = ticket.event.toString();
      if (!acc[eventId]) acc[eventId] = [];
      acc[eventId].push(ticket);
      return acc;
    }, {});
    
    // Add tickets to events
    events.forEach(event => {
      event.tickets = ticketsByEvent[event._id.toString()] || [];
    });
  }

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

  if (applyTicketAvailabilityRules(event).changed) {
    await event.save();
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


  if (req.file) {
    req.body.coverImages = [`/uploads/${req.file.filename}`];
  }

  try {
    if (typeof req.body.location === "string") {
      req.body.location = JSON.parse(req.body.location);
    }
    if (typeof req.body.ageRestriction === "string") {
      req.body.ageRestriction = JSON.parse(req.body.ageRestriction);
    }
    if (typeof req.body.ticketTypes === "string") {
      try {
        req.body.ticketTypes = JSON.parse(req.body.ticketTypes);
      } catch (error) {
        req.body.ticketTypes = parseTicketTypesInput(req.body.ticketTypes, req.body);
      }
    }
    if (typeof req.body.tags === "string") {
      
    }
  } catch (error) {
    console.error("Error parsing JSON fields in updateEvent:", error);
    return res.status(StatusCodes.BAD_REQUEST).json({
      status: "fail",
      message: "Invalid JSON format for location, ageRestriction, or ticketTypes",
    });
  }


  if (req.body.tags && typeof req.body.tags === "string") {
     req.body.tags = req.body.tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  if (req.body.ticketTypes) {
    const normalizedTicketTypes = normalizeTicketTypes(
      parseTicketTypesInput(req.body.ticketTypes, req.body)
    );
    req.body.ticketTypes = applyManualAvailabilityOverrides(
      event.ticketTypes,
      normalizedTicketTypes
    );
  }

  Object.assign(event, req.body);
  
 
    
  event.updatedAt = new Date();

  await event.save();

  if (applyTicketAvailabilityRules(event).changed) {
    await event.save();
  }
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
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 10;

  const events = await Event.find()
    .populate("category", "name description")
    .populate({
      path: "organizer",
      select: "firstName lastName email",
      populate: {
        path: "organizerProfile",
        select: "organization",
      },
    })
    .sort("-createdAt")
    .skip((page - 1) * limit)
    .limit(Number(limit));

  await Promise.all(events.map((event) => ensureEventUrlFields(event)));

  const eventIds = events.map((event) => event._id);

  let ticketStatsByEvent = new Map();
  if (eventIds.length > 0) {
    const ticketStats = await Ticket.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          price: { $gt: 0 },
        },
      },
      {
        $addFields: {
          ticketQuantity: {
            $cond: [
              { $gt: ["$purchaseQuantity", 0] },
              "$purchaseQuantity",
              {
                $cond: [{ $gt: ["$ticketCount", 0] }, "$ticketCount", 1],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$event",
          ticketsSold: { $sum: "$ticketQuantity" },
        },
      },
    ]);

    ticketStatsByEvent = new Map(
      ticketStats.map((item) => [item._id.toString(), item.ticketsSold || 0])
    );
  }

  const eventsWithTicketsSold = events.map((event) => {
    const plainEvent = event.toObject();
    return {
      ...plainEvent,
      ticketsSold: ticketStatsByEvent.get(event._id.toString()) || 0,
    };
  });

  const total = await Event.countDocuments();

  res.status(StatusCodes.OK).json({
    status: "success",
    data: eventsWithTicketsSold,
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
  try {
    const { id } = req.params;

    // Validate ObjectId format
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ 
        status: "error", 
        message: "Invalid event ID format" 
      });
    }

    const event = await Event.findOne({ _id: id })
      .populate("category", "name description")
      .populate({
        path: "organizer",
        select: "firstName lastName email",
        populate: {
          path: "organizerProfile",
          select: "organization",
        },
      });

    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({ 
        status: "error", 
        message: "Event not found" 
      });
    }

    await ensureEventUrlFields(event);

    if (applyTicketAvailabilityRules(event).changed) {
      await event.save();
    }

    res.status(StatusCodes.OK).json({ status: "success", data: event });
  } catch (error) {
    console.error("[EVENT-DETAILS] Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch event details",
    });
  }
};

const getEventDetailsByShortId = async (req, res) => {
  try {
    const { shortId } = req.params;

    if (!shortId || !/^[a-z0-9]{4}$/i.test(shortId)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Invalid event short ID format",
      });
    }

    const event = await Event.findOne({ shortId: shortId.toLowerCase() })
      .populate("category", "name description")
      .populate({
        path: "organizer",
        select: "firstName lastName email",
        populate: {
          path: "organizerProfile",
          select: "organization",
        },
      });

    if (!event) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: "error",
        message: "Event not found",
      });
    }

    await ensureEventUrlFields(event);

    if (applyTicketAvailabilityRules(event).changed) {
      await event.save();
    }

    res.status(StatusCodes.OK).json({ status: "success", data: event });
  } catch (error) {
    console.error("[EVENT-DETAILS-BY-SHORT-ID] Error:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch event details",
    });
  }
};

/* ======================================================
   PUBLIC EVENTS
====================================================== */
const getPublicEvents = async (req, res) => {
  try {
    const { isFeatured, isTrending, limit, skip, sort } = req.query;

    const query = {
      status: "published",
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }],
    };

    // Optional feature/trending filters
    if (isFeatured === "true") query.isFeatured = true;
    if (isTrending === "true") query.isTrending = true;

    // Sorting and pagination
    const sortOption = sort || "-createdAt";
    const numericSkip = Number.isNaN(parseInt(skip, 10))
      ? 0
      : parseInt(skip, 10);

    const parsedLimit = parseInt(limit, 10);
    const hasLimit = !Number.isNaN(parsedLimit);
    const safeLimit = hasLimit
      ? Math.max(1, Math.min(parsedLimit, 100))
      : undefined;

    let findQuery = Event.find(query)
      .populate("category", "name description")
      .populate({
        path: "organizer",
        select: "firstName lastName email",
        populate: {
          path: "organizerProfile",
          select: "organization",
        },
      })
      .sort(sortOption);

    if (hasLimit) {
      findQuery = findQuery.skip(numericSkip).limit(safeLimit);
    }

    const [events, total] = await Promise.all([
      findQuery,
      Event.countDocuments(query),
    ]);

      await Promise.all(events.map((event) => ensureEventUrlFields(event)));

    for (const event of events) {
      if (applyTicketAvailabilityRules(event).changed) {
        await event.save();
      }
    }

    res.status(StatusCodes.OK).json({
      status: "success",
      data: events,
      meta: {
        total,
        limit: hasLimit ? safeLimit : undefined,
        skip: hasLimit ? numericSkip : undefined,
        hasMore: hasLimit ? numericSkip + safeLimit < total : false,
      },
    });
  } catch (error) {
    console.error("[PUBLIC-EVENTS] Error fetching public events", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: "error",
      message: "Failed to fetch public events",
    });
  }
};

/* ======================================================
   CANCEL EVENT
====================================================== */
const cancelEvent = async (req, res) => {
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

  if (
    event.organizer.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

  const parsedTicketTypes = parseTicketTypesInput(ticketTypes, req.body);
  const normalizedTicketTypes = normalizeTicketTypes(parsedTicketTypes);

  event.ticketTypes = applyManualAvailabilityOverrides(
    event.ticketTypes,
    normalizedTicketTypes
  );

  applyTicketAvailabilityRules(event);

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
  const targetUserId = req.user?.userId || req.params.userId;

  if (!targetUserId) {
    throw new UnauthorizedError("Authentication invalid");
  }

  // Only allow users to read their own wishlist unless admin
  if (
    req.user?.role !== "admin" &&
    req.user?.userId &&
    req.params.userId &&
    req.user.userId !== req.params.userId
  ) {
    throw new UnauthorizedError("Not authorized to access wishlist");
  }

  const user = await User.findById(targetUserId).populate("wishlist");

  if (!user) {
    throw new NotFoundError("User not found");
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    data: user.wishlist || [],
  });
};

const updateWishlist = async (req, res) => {
  const userId = req.user?.userId || req.params.userId;
  const { eventId, action } = req.body;

  if (!userId) {
    throw new UnauthorizedError("Authentication invalid");
  }

  // Prevent users from mutating another user's wishlist unless admin
  if (
    req.user?.role !== "admin" &&
    req.user?.userId &&
    req.params.userId &&
    req.user.userId !== req.params.userId
  ) {
    throw new UnauthorizedError("Not authorized to modify wishlist");
  }

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

const toggleFeaturedStatus = async (req, res) => {
  const { id } = req.params;
  const { isFeatured } = req.body;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");
  if (req.user.role !== "admin") throw new BadRequestError("Not authorized");

  event.isFeatured = typeof isFeatured === "boolean" ? isFeatured : !event.isFeatured;
  await event.save();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Featured status updated",
    data: event,
  });
};

const toggleTrendingStatus = async (req, res) => {
  const { id } = req.params;
  const { isTrending } = req.body;

  const event = await Event.findById(id);
  if (!event) throw new NotFoundError("Event not found");
  if (req.user.role !== "admin") throw new BadRequestError("Not authorized");

  event.isTrending = typeof isTrending === "boolean" ? isTrending : !event.isTrending;
  await event.save();

  res.status(StatusCodes.OK).json({
    status: "success",
    message: "Trending status updated",
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
  getEventDetailsByShortId,
  getWishlist,
  updateWishlist,
  toggleBannerStatus,
  toggleFeaturedStatus,
  toggleTrendingStatus,
  updateTicketAvailability,
};
