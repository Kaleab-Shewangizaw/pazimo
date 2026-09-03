const Event = require("../models/Event");
const User = require("../models/User");
const Payment = require("../models/Payment");
const SantimTransaction = require("../models/SantimTransaction");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const Ticket = require("../models/Ticket");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { applyTicketAvailabilityRules } = require("../utils/ticketAvailability");
const { claimTicketStock } = require("../utils/ticketStock");
const { resolveEatInstant } = require("../utils/eatTime");
const { isPhoneBanned, flagTamperAttempt } = require("../utils/fraudGuard");
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

// Roles allowed to see full, unsanitized event data (draft events, organizer
// email, internal ticket-wave config) on otherwise-public listing endpoints.
const PRIVILEGED_EVENT_ROLES = ["admin", "organizer", "partner"];

const sanitizePublicOrganizer = (organizer) => {
  if (!organizer || typeof organizer !== "object") return organizer;
  const { firstName, lastName, fullName, organizerProfile } = organizer;
  return {
    _id: organizer._id,
    firstName,
    lastName,
    fullName: fullName || `${firstName || ""} ${lastName || ""}`.trim(),
    organizerProfile: organizerProfile
      ? { organization: organizerProfile.organization }
      : undefined,
  };
};

const sanitizePublicTicketTypes = (ticketTypes = []) =>
  ticketTypes.map((ticket) => ({
    _id: ticket._id,
    name: ticket.name,
    price: ticket.price,
    priceETB: ticket.priceETB,
    priceUSD: ticket.priceUSD,
    quantity: ticket.quantity,
    description: ticket.description,
    available: ticket.available,
  }));

// Strips internal/admin-only fields (organizer email, ticket-wave scheduling
// config, Mongoose version key, Pazimo's commission/VAT arrangement with the
// organizer) before an event is sent to an unauthenticated caller.
//
// This is a blocklist (`...rest` keeps everything not named here), which is
// exactly how commissionRate/beverageCommissionRate/coversOrganizerVat ended
// up leaking to every visitor on the public event page — they were added to
// the Event schema after this function was written and nobody had to touch
// this list for them to start flowing straight through. Found 2026-09-03.
// Any new commercial/internal field added to Event needs adding here too;
// there's no compiler check that catches the omission the way an allowlist
// would, so treat this list as needing a second look whenever the Event
// schema grows.
const sanitizePublicEvent = (eventDoc) => {
  const event =
    typeof eventDoc.toObject === "function" ? eventDoc.toObject() : eventDoc;
  const {
    __v,
    organizer,
    ticketTypes,
    commissionRate,
    beverageCommissionRate,
    coversOrganizerVat,
    ...rest
  } = event;
  return {
    ...rest,
    organizer: sanitizePublicOrganizer(organizer),
    ticketTypes: sanitizePublicTicketTypes(ticketTypes),
  };
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

// Normalizes one entry of a ticket type's nested `waves` array. Mirrors the
// same coercion `normalizeTicketTypes` applies to a top-level ticket, since a
// wave is really the same shape (name/prices/quantity/dates/switch mode).
const normalizeWaveEntry = (rawWave = {}, isFirstWave = false) => {
  const priceETB = toNumberOrUndefined(rawWave.priceETB);
  const priceUSD = toNumberOrUndefined(rawWave.priceUSD);
  const price =
    toNumberOrUndefined(rawWave.price) ??
    (priceETB !== undefined ? priceETB : priceUSD !== undefined ? priceUSD : 0);

  const quantity = toNumberOrUndefined(rawWave.quantity) ?? 0;

  // Wave 1 is always immediately live — it never has a start trigger.
  const startDate = isFirstWave
    ? undefined
    : resolveEatInstant(
        rawWave.startDate || rawWave.saleStartDate,
        rawWave.startTime || rawWave.saleStartTime
      );
  const endDate = resolveEatInstant(
    rawWave.endDate || rawWave.saleEndDate,
    rawWave.endTime || rawWave.saleEndTime
  );

  return {
    name: rawWave.name,
    price,
    priceETB,
    priceUSD,
    quantity,
    description: rawWave.description,
    startDate,
    endDate,
    waveSwitchMode: normalizeWaveSwitchMode(
      rawWave.waveSwitchMode || rawWave.waveActivationType
    ),
  };
};

const normalizeTicketTypes = (rawTickets = []) =>
  rawTickets.map((ticket) => {
    const priceETB = toNumberOrUndefined(ticket.priceETB);
    const priceUSD = toNumberOrUndefined(ticket.priceUSD);
    const price =
      toNumberOrUndefined(ticket.price) ??
      (priceETB !== undefined ? priceETB : priceUSD !== undefined ? priceUSD : 0);

    const quantity = toNumberOrUndefined(ticket.quantity) ?? 0;

    const rawWaves = Array.isArray(ticket.waves) ? ticket.waves : [];
    const waves =
      rawWaves.length > 0
        ? rawWaves.map((rawWave, index) => normalizeWaveEntry(rawWave, index === 0))
        : undefined;

    // Organizers pick a wall-clock Ethiopian date *and* time ("Aug 19, 8:00 PM").
    // Anchor it to EAT explicitly: a bare "YYYY-MM-DD" run through `new Date()`
    // parses as UTC midnight, which is 3:00 AM in Addis, so date-only wave
    // transitions used to fire three hours after the organizer expected.
    const startDate = resolveEatInstant(
      ticket.startDate || ticket.saleStartDate,
      ticket.startTime || ticket.saleStartTime
    );
    const endDate = resolveEatInstant(
      ticket.endDate || ticket.saleEndDate,
      ticket.endTime || ticket.saleEndTime
    );
    const inferredWaveOrder = detectWaveOrderFromName(ticket.name);
    const waveOrder = toNumberOrUndefined(ticket.waveOrder) ?? inferredWaveOrder;
    const waveSwitchMode = normalizeWaveSwitchMode(
      ticket.waveSwitchMode || ticket.waveActivationType
    );
    const hasWaveMetadata =
      !!ticket.waveGroup || waveOrder !== undefined || /wave/i.test(ticket.name || "");
    const normalizedStartDate =
      hasWaveMetadata && waveOrder === 1 ? undefined : startDate;
    const normalizedEndDate =
      hasWaveMetadata ? undefined : endDate;

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
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      ...(ticket.waveGroup ? { waveGroup: ticket.waveGroup } : {}),
      ...(waveOrder !== undefined ? { waveOrder } : {}),
      ...(hasWaveMetadata ? { waveSwitchMode } : {}),
      ...(waves ? { waves } : {}),
      // Carried through only so applyManualAvailabilityOverrides can match
      // this submission against its existing subdocument by id; stripped
      // out (replaced with the existing id) before it reaches the schema.
      ...(ticket._id ? { _id: ticket._id } : {}),
    };
  });

// Deliberately excludes waveOrder: deleting a wave from the middle of a chain
// shifts every later wave's waveOrder down, which would otherwise make a
// surviving wave's key stop matching its own prior record on the very save
// that removes its sibling, silently losing any manualDisabled override.
// Waves are still distinguished by name within their waveGroup.
const createTicketTypeKey = (ticket = {}) => {
  const name = String(ticket.name || "").trim().toLowerCase();
  const waveGroup = String(ticket.waveGroup || "").trim().toLowerCase();
  return `${name}::${waveGroup}`;
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

const hasNestedWaves = (ticket) =>
  Array.isArray(ticket && ticket.waves) && ticket.waves.length > 0;

// A wave-enabled ticket type's `currentWaveIndex` points into its own
// `waves` array by position. If the organizer edited that array (reordered,
// inserted, deleted a wave), the old integer may now point at the wrong
// entry. Re-resolve it by matching the currently-mirrored wave's name into
// the new array; if that wave was itself removed, fall back to the old
// index clamped into range — applyTicketAvailabilityRules re-validates it
// immediately since it always runs right after save.
const resolveCarriedWaveIndex = (existing, nextWaves) => {
  if (!existing || !Array.isArray(nextWaves) || nextWaves.length === 0) {
    return null;
  }

  const byName = nextWaves.findIndex((wave) => wave.name === existing.name);
  if (byName !== -1) return byName;

  const fallback =
    typeof existing.currentWaveIndex === "number" ? existing.currentWaveIndex : 0;
  return Math.min(Math.max(fallback, 0), nextWaves.length - 1);
};

// Preserve and infer manual disable intent from admin edits.
const applyManualAvailabilityOverrides = (
  existingTicketTypes = [],
  nextTicketTypes = []
) => {
  const existingById = new Map(
    (existingTicketTypes || [])
      .filter((ticket) => ticket && ticket._id)
      .map((ticket) => [String(ticket._id), ticket])
  );
  const existingByKey = new Map(
    (existingTicketTypes || []).map((ticket) => [
      createTicketTypeKey(ticket),
      ticket,
    ])
  );

  return (nextTicketTypes || []).map((ticket) => {
    const existing =
      (ticket._id && existingById.get(String(ticket._id))) ||
      existingByKey.get(createTicketTypeKey(ticket));

    // Manual disabling is now an *explicit* signal only.
    //
    // This used to also infer intent: if the submitted `available` disagreed
    // with the stored one, the difference was written back as a permanent
    // `manualDisabled: true`. But `available` is a derived flag that the wave
    // engine owns, and the edit forms recomputed it client-side with rules that
    // did not match the server's. Any drift — an admin form that did not
    // understand a switch mode, a wave that transitioned between page load and
    // save — turned an untouched round-trip through the edit screen into a
    // permanently dead wave, which then stalled the rest of the chain behind it.
    const manualDisabled =
      typeof ticket.manualDisabled === "boolean"
        ? ticket.manualDisabled
        : Boolean(existing?.manualDisabled);

    // A nested-wave ticket type's own top-level `quantity` is the one
    // genuinely live, sale-tracked field — applyTicketAvailabilityRules only
    // ever seeds it from the active wave's config on an actual transition,
    // so it must never be reset here to whatever (possibly stale) value the
    // client happened to submit. name/price/description/dates are just
    // config and get freshly re-synced from `waves[currentWaveIndex]` by
    // applyTicketAvailabilityRules right after this runs regardless of what
    // is returned here, so they pass straight through from the submission —
    // that's what lets an organizer's edit to an already-active wave's name
    // or price actually take effect. Only the chain *position* needs to be
    // explicitly carried over (re-resolved in case the wave list was
    // reordered), so a save with no real change can't accidentally rewind it.
    if (existing && hasNestedWaves(existing) && hasNestedWaves(ticket)) {
      return {
        ...ticket,
        _id: existing._id,
        quantity: existing.quantity,
        currentWaveIndex: resolveCarriedWaveIndex(existing, ticket.waves),
        manualDisabled,
        available: manualDisabled ? false : existing.available,
      };
    }

    return {
      ...ticket,
      // Preserve the subdocument identity across edits. Replacing the array
      // wholesale would make Mongoose mint fresh _ids for every ticket type,
      // breaking in-flight checkouts that reference the old ticketTypeId.
      ...(existing?._id ? { _id: existing._id } : {}),
      manualDisabled,
      // Availability itself is always recomputed by applyTicketAvailabilityRules
      // right after this; never let a stale client value decide what is live.
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

  // The organizer an event is attached to must come from the verified JWT,
  // not the request body — a client-supplied `organizer` field let any
  // authenticated customer attach a fraudulent event to an arbitrary real
  // organizer (confirmed 2026-09-03 against a real organizer account).
  // Admins are the one legitimate exception: they manage events on behalf of
  // organizers and need to set this explicitly.
  if (!(req.user && req.user.role === "admin" && organizer)) {
    organizer = req.user && req.user.userId;
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

  const buyer = await User.findById(userId).select("phoneNumber");
  if (buyer?.phoneNumber && (await isPhoneBanned(buyer.phoneNumber))) {
    return res.status(StatusCodes.FORBIDDEN).json({
      status: "error",
      code: "ACCOUNT_BANNED",
      message: "This account is not permitted to purchase tickets.",
    });
  }

  const event = await Event.findById(eventId);
  if (!event) throw new NotFoundError("Event not found");

  const now = new Date();
  const { changed: prePurchaseUpdated } = applyTicketAvailabilityRules(event, now);
  if (prePurchaseUpdated) {
    await event.save();
  }

  const index = event.ticketTypes.findIndex(
    (t) => t.name === ticketType || t._id.toString() === ticketType
  );

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

  // A ticket only becomes active/paid if we can independently verify a
  // completed payment for this exact purchase. Never trust the client's
  // say-so here — that's what let anyone get a free active ticket by simply
  // omitting paymentReference.
  let isVerifiedPaid = false;
  if (paymentReference) {
    const paidMatch = await Payment.findOne({
      transactionId: paymentReference,
      status: "PAID",
      eventId: event._id,
      userId,
    });

    const completedMatch =
      !paidMatch &&
      (await SantimTransaction.findOne({
        transactionId: paymentReference,
        status: "COMPLETED",
        "metaData.eventId": String(event._id),
        "metaData.userId": String(userId),
      }));

    if (!paidMatch && !completedMatch) {
      if (buyer?.phoneNumber) {
        await flagTamperAttempt({
          phone: buyer.phoneNumber,
          userId,
          reason: "Forged paymentReference on POST /events/:id/buy",
          meta: { eventId: String(event._id), ticketType, quantity, paymentReference },
        });
      }
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: "error",
        message: "Payment could not be verified.",
      });
    }
    isVerifiedPaid = true;
  }

  // Claim the stock atomically. The availability/quantity check above reads a
  // snapshot that two simultaneous buyers can both pass; only a conditional
  // decrement in a single database operation can decide who actually gets the
  // last tickets. This also hands the chain off to the next wave the moment
  // this one empties.
  const claim = await claimTicketStock({
    eventId: event._id,
    ticketTypeId: selectedType._id,
    ticketTypeName: selectedType.name,
    count: quantity,
    now,
  });

  if (!claim.claimed) {
    throw new BadRequestError("Not enough tickets available");
  }

  const ticket = await Ticket.create({
    event: event._id,
    user: userId,
    ticketType: selectedType.name,
    ticketTypeId: selectedType._id,
    price: selectedType.price * quantity,
    ticketCount: quantity,
    purchaseQuantity: quantity,
    paymentReference:
      paymentReference ||
      `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: isVerifiedPaid ? "active" : "pending",
    paymentStatus: isVerifiedPaid ? "completed" : "pending",
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: isVerifiedPaid
      ? "Tickets purchased successfully"
      : "Ticket reserved — awaiting payment confirmation",
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

  for (const event of events) {
    if (applyTicketAvailabilityRules(event).changed) {
      await event.save();
    }
  }

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


  const uploadedCoverFiles = [];

  if (Array.isArray(req.files)) {
    uploadedCoverFiles.push(...req.files);
  } else if (req.files && typeof req.files === "object") {
    if (Array.isArray(req.files.coverImages)) {
      uploadedCoverFiles.push(...req.files.coverImages);
    }

    if (Array.isArray(req.files.coverImage)) {
      uploadedCoverFiles.push(...req.files.coverImage);
    }
  }

  if (req.file) {
    uploadedCoverFiles.push(req.file);
  }

  if (uploadedCoverFiles.length > 0) {
    req.body.coverImages = uploadedCoverFiles.map(
      (file) => `/uploads/${file.filename}`,
    );
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

  // This route has no auth middleware in front of it (the public homepage
  // and admin dashboard both hit it), so privilege is resolved per-request
  // from optionalAuth instead. Anonymous callers only ever get published,
  // public events with sanitized fields; admins/organizers keep seeing
  // everything, matching the existing admin dashboard behavior.
  const isPrivileged =
    !!req.user && PRIVILEGED_EVENT_ROLES.includes(req.user.role);

  const query = {};
  if (!isPrivileged) {
    query.status = "published";
    query.$or = [{ isPublic: true }, { isPublic: { $exists: false } }];
  } else if (req.query.status) {
    query.status = req.query.status;
  }

  const events = await Event.find(query)
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

  // This listing feeds the public homepage, so it has to reflect the live wave
  // just like the detail endpoints do — otherwise a card can advertise a price
  // from a wave that already handed off.
  for (const event of events) {
    if (applyTicketAvailabilityRules(event).changed) {
      await event.save();
    }
  }

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
    const plainEvent = isPrivileged
      ? event.toObject()
      : sanitizePublicEvent(event);
    return {
      ...plainEvent,
      ticketsSold: ticketStatsByEvent.get(event._id.toString()) || 0,
    };
  });

  const total = await Event.countDocuments(query);

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

  // Had no ownership check at all — any authenticated user could change the
  // status of any event on the platform, not just publish their own draft.
  // Same rule as updateEvent/cancelEvent. Confirmed missing 2026-09-03.
  if (
    event.organizer.toString() !== req.user.userId &&
    req.user.role !== "admin"
  ) {
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .json({ message: "Not authorized" });
  }

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
        select: "firstName lastName",
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

    // This route serves both the public event page (no auth) and the
    // organizer/admin edit forms, which need the real ticketTypes shape —
    // wave config, manualDisabled, currentWaveIndex — to load a wave chain
    // back into "Manage waves". sanitizePublicEvent strips all of that, so a
    // privileged caller (the event's own organizer, or an admin) gets the
    // full document instead; anyone else still gets the sanitized one.
    const organizerId = String(event.organizer?._id || event.organizer || "");
    const isPrivileged =
      !!req.user &&
      (req.user.role === "admin" || req.user.userId === organizerId);

    res.status(StatusCodes.OK).json({
      status: "success",
      data: isPrivileged ? event.toObject() : sanitizePublicEvent(event),
    });
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
        select: "firstName lastName",
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

    res
      .status(StatusCodes.OK)
      .json({ status: "success", data: sanitizePublicEvent(event) });
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
        select: "firstName lastName",
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
      data: events.map(sanitizePublicEvent),
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
