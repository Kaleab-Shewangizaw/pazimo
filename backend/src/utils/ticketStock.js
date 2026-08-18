const Event = require("../models/Event");
const { applyTicketAvailabilityRules } = require("./ticketAvailability");

/**
 * Re-evaluate wave/date availability for one event and persist any change.
 *
 * Kept deliberately narrow: `applyTicketAvailabilityRules` only ever mutates
 * the `available` flag, so the resulting save touches nothing but those paths
 * and cannot clobber a concurrent stock decrement.
 */
const refreshEventAvailability = async (eventId, now = new Date()) => {
  const event = await Event.findById(eventId);
  if (!event) return null;

  if (applyTicketAvailabilityRules(event, now).changed) {
    await event.save();
  }

  return event;
};

const matchTicketType = (event, { ticketTypeId, ticketTypeName }) => {
  if (!event || !Array.isArray(event.ticketTypes)) return null;

  if (ticketTypeId) {
    const byId = event.ticketTypes.find(
      (type) => String(type._id) === String(ticketTypeId)
    );
    if (byId) return byId;
  }

  if (ticketTypeName) {
    const byName = event.ticketTypes.find(
      (type) => type.name === ticketTypeName
    );
    if (byName) return byName;
  }

  // Legacy callers passed the ticket type as a bare string that could be either
  // an id or a name.
  return null;
};

/**
 * Atomically claim `count` tickets from one ticket type.
 *
 * The availability check and the decrement have to happen in a single database
 * operation. Reading "is there enough left?" and then writing the decrement as
 * two steps lets two concurrent buyers both observe the last ticket as free and
 * both take it, which oversells the wave and — because sell-out is what drives
 * the chain forward — can also strand the next wave.
 *
 * Availability is refreshed before the claim so a wave that *should* already be
 * live (its start time passed, or its predecessor just sold out) is not refused
 * merely because no request had re-evaluated the chain yet.
 *
 * Returns { claimed, ticketType, reason }. `claimed: false` means the caller
 * must abort the sale — never fall back to a non-atomic write.
 */
const claimTicketStock = async ({
  eventId,
  ticketTypeId,
  ticketTypeName,
  count = 1,
  now = new Date(),
  // Customer sales must come from the live wave. Organizer-issued invitations
  // draw down the same allocation but are not sales, so they are allowed
  // against a wave that is not currently the active one — matching how
  // invitations behaved before stock claiming was made atomic.
  requireAvailable = true,
}) => {
  const requested = Math.max(1, Number(count) || 1);

  const event = await refreshEventAvailability(eventId, now);
  if (!event) return { claimed: false, reason: "EVENT_NOT_FOUND" };

  const ticketType = matchTicketType(event, { ticketTypeId, ticketTypeName });
  if (!ticketType) return { claimed: false, reason: "TICKET_TYPE_NOT_FOUND" };

  const claim = await Event.updateOne(
    {
      _id: eventId,
      ticketTypes: {
        $elemMatch: {
          _id: ticketType._id,
          ...(requireAvailable ? { available: true } : {}),
          quantity: { $gte: requested },
        },
      },
    },
    { $inc: { "ticketTypes.$.quantity": -requested } }
  );

  if (claim.matchedCount === 0) {
    return { claimed: false, ticketType, reason: "UNAVAILABLE_OR_SOLD_OUT" };
  }

  // The claim may have just emptied this wave. Hand off to the next one now so
  // the following customer sees the new wave immediately rather than waiting
  // for the next scheduler tick.
  await refreshEventAvailability(eventId, now);

  return { claimed: true, ticketType };
};

/**
 * Return previously claimed stock (cancellation, refund, failed fulfilment) and
 * re-evaluate the chain, which may reopen an earlier wave.
 */
const releaseTicketStock = async ({
  eventId,
  ticketTypeId,
  ticketTypeName,
  count = 1,
  now = new Date(),
}) => {
  const amount = Math.max(1, Number(count) || 1);

  const event = await Event.findById(eventId);
  if (!event) return { released: false, reason: "EVENT_NOT_FOUND" };

  const ticketType = matchTicketType(event, { ticketTypeId, ticketTypeName });
  if (!ticketType) return { released: false, reason: "TICKET_TYPE_NOT_FOUND" };

  await Event.updateOne(
    { _id: eventId, "ticketTypes._id": ticketType._id },
    { $inc: { "ticketTypes.$.quantity": amount } }
  );

  await refreshEventAvailability(eventId, now);

  return { released: true, ticketType };
};

module.exports = {
  claimTicketStock,
  releaseTicketStock,
  refreshEventAvailability,
};
