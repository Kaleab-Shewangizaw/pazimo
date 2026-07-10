const mongoose = require("mongoose");
const Event = require("../models/Event");

// Event links/checkout can reference an event either by its Mongo _id or by
// its short, URL-friendly shortId (e.g. from the canonical /events/:slug-:shortId
// route) — resolve either so pricing checks don't reject valid checkouts.
const findEventForPricing = async (eventId) => {
  const normalizedEventId = String(eventId).trim();

  if (mongoose.Types.ObjectId.isValid(normalizedEventId)) {
    const eventById = await Event.findById(normalizedEventId);
    if (eventById) return eventById;
  }

  return Event.findOne({ shortId: normalizedEventId.toLowerCase() });
};

// Computes the real, non-negotiable ticket price server-side from the event's
// own ticket type data. Callers must never substitute a client-supplied amount
// for the `amount` this returns — that field is the only trustworthy price.
const resolveTicketPrice = async ({ eventId, ticketTypeId, quantity, currency = "ETB" }) => {
  const qty = parseInt(quantity, 10);
  if (!eventId || !ticketTypeId || !Number.isFinite(qty) || qty < 1) {
    return {
      ok: false,
      statusCode: 400,
      message: "eventId, ticketTypeId and a positive quantity are required",
    };
  }

  let event;
  try {
    event = await findEventForPricing(eventId);
  } catch (err) {
    return { ok: false, statusCode: 400, message: "Invalid eventId" };
  }
  if (!event) {
    return { ok: false, statusCode: 404, message: "Event not found" };
  }

  const ticketType = event.ticketTypes.find(
    (t) => t.name === ticketTypeId || t._id.toString() === String(ticketTypeId)
  );
  if (!ticketType) {
    return { ok: false, statusCode: 400, message: "Invalid ticket type" };
  }

  if (!ticketType.available || ticketType.quantity < qty) {
    return { ok: false, statusCode: 400, message: "Not enough tickets available" };
  }

  const unitPrice =
    currency === "USD"
      ? Number(ticketType.priceUSD ?? ticketType.price ?? 0)
      : Number(ticketType.priceETB ?? ticketType.price ?? 0);

  const amount = Math.round(unitPrice * qty * 100) / 100;

  return { ok: true, event, ticketType, quantity: qty, unitPrice, amount };
};

const amountsMatch = (a, b, tolerance = 0.01) => {
  const numA = Number(a);
  const numB = Number(b);
  return Number.isFinite(numA) && Number.isFinite(numB) && Math.abs(numA - numB) <= tolerance;
};

module.exports = { resolveTicketPrice, amountsMatch };
