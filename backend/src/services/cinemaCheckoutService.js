const mongoose = require("mongoose");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaBeverage = require("../models/CinemaBeverage");
const CinemaHall = require("../models/CinemaHall");
const seatService = require("./cinemaSeatService");
const { BadRequestError, NotFoundError } = require("../errors");

// Cinema checkout: what a basket costs, and what it locks while it is paid for.
//
// THE RULE THIS FILE EXISTS TO ENFORCE
//
// The client says WHAT it wants — which screening, which seats, which snacks —
// and never what any of it costs. Every figure below is recomputed here from
// the showtime's own tiers and the cinema's own line-up. A price that arrived
// in a request body is never read, so a tampered basket cannot buy a 400 ETB
// VIP seat for 1 ETB. Same rule utils/pricing.js states for events and
// concessionBasketService states for drinks.
//
// WHAT "CHECKOUT" OWNS AND WHAT IT DOES NOT
//
// This prices and reserves. It does not talk to a payment provider and does not
// create tickets. The provider call belongs to the route (it differs per
// provider and per currency) and ticket creation belongs to settlement, which
// runs from the webhook. Keeping those apart is what lets the same basket be
// paid for by Chapa or SantimPay without this file knowing either exists.

const MAX_SEATS_PER_ORDER = 10;
const MAX_CONCESSION_LINES = 20;
const MAX_QUANTITY_PER_LINE = 20;

const round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;

/**
 * Price the ticket half of a basket.
 *
 * Two shapes, because halls differ:
 *   assigned seating — the caller names SEATS, and each seat's category decides
 *                      its tier and therefore its price
 *   unassigned       — the caller names a TIER and a quantity, as today
 *
 * Returning the resolved tier per seat matters downstream: settlement writes one
 * ticket per seat and needs to know which tier's counter to decrement.
 */
const priceTickets = async ({ showtime, hall, seatKeys, ticketTypeId, quantity }) => {
  const tiersByCategory = new Map();
  for (const tier of showtime.ticketTypes || []) {
    if (tier.seatCategoryKey) tiersByCategory.set(tier.seatCategoryKey, tier);
  }

  if (hall.hasAssignedSeating) {
    if (!Array.isArray(seatKeys) || seatKeys.length === 0) {
      throw new BadRequestError("Pick at least one seat");
    }
    if (seatKeys.length > MAX_SEATS_PER_ORDER) {
      throw new BadRequestError(
        `You can book at most ${MAX_SEATS_PER_ORDER} seats in one order`
      );
    }

    const byKey = new Map(hall.sellableSeats().map((s) => [s.seatKey, s]));
    const categoryLabels = new Map(
      (hall.seatCategories || []).map((c) => [c.key, c.label])
    );

    const lines = seatKeys.map((key) => {
      const seat = byKey.get(String(key).trim());
      // One message for unknown, gap and blocked alike: a caller probing keys
      // should not be able to map the room from the errors it gets back.
      if (!seat) throw new BadRequestError(`Seat ${key} cannot be booked`);

      const tier = tiersByCategory.get(seat.categoryKey);
      if (!tier) {
        // Almost always one specific situation: the screening was scheduled
        // BEFORE the hall had a seat map, so its tiers carry allocations rather
        // than seat categories. Named explicitly, because "no price for this
        // seat" sends an operator hunting through the seat map when the thing
        // to fix is the screening.
        throw new BadRequestError(
          tiersByCategory.size === 0
            ? "This screening was scheduled before the hall had a seat map, so its ticket types are not priced per seat category yet. The cinema needs to re-save its prices."
            : `Seat ${seat.seatKey} is a ${seat.categoryKey} seat and no ticket type prices that category for this screening`
        );
      }
      if (!tier.isAvailable) {
        throw new BadRequestError(`${tier.name} seats are not on sale`);
      }

      return {
        seatKey: seat.seatKey,
        row: seat.row,
        number: seat.number,
        categoryKey: seat.categoryKey,
        categoryLabel: categoryLabels.get(seat.categoryKey) || seat.categoryKey,
        ticketTypeId: String(tier._id),
        ticketType: tier.name,
        // Read off the showtime, never off the request.
        price: tier.price,
      };
    });

    return { lines, total: round2(lines.reduce((sum, l) => sum + l.price, 0)) };
  }

  // --- unassigned hall: tier + quantity ---------------------------------
  const requested = Number(quantity) || 1;
  if (!Number.isInteger(requested) || requested < 1) {
    throw new BadRequestError("quantity must be a whole number of at least 1");
  }
  if (requested > MAX_SEATS_PER_ORDER) {
    throw new BadRequestError(
      `You can book at most ${MAX_SEATS_PER_ORDER} seats in one order`
    );
  }

  const tier = showtime.ticketTypes.id(ticketTypeId);
  if (!tier) throw new NotFoundError("Ticket type not found for that screening");
  if (!tier.isAvailable) throw new BadRequestError(`${tier.name} is not on sale`);

  const remaining = Math.max(tier.allocation - tier.sold, 0);
  if (remaining < requested) {
    throw new BadRequestError(
      remaining === 0
        ? `${tier.name} is sold out for this screening`
        : `Only ${remaining} ${tier.name} seats left`
    );
  }

  // One line per seat here too, so settlement has one shape to handle rather
  // than two — the only difference is that these lines carry no seat.
  const lines = Array.from({ length: requested }, () => ({
    ticketTypeId: String(tier._id),
    ticketType: tier.name,
    price: tier.price,
  }));

  return { lines, total: round2(tier.price * requested) };
};

/**
 * Price the snacks half of a basket, against this cinema's own line-up.
 *
 * Availability is checked for a friendly error, but it is NOT the guarantee —
 * stock is claimed atomically at fulfilment. Two people can both be told "yes"
 * here and only one of them get the last bucket of popcorn, which is why
 * settlement, not this function, is where stock actually moves.
 */
const priceConcessions = async ({ cinemaId, items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { lines: [], total: 0 };
  }
  if (items.length > MAX_CONCESSION_LINES) {
    throw new BadRequestError(
      `A basket can hold at most ${MAX_CONCESSION_LINES} different items`
    );
  }

  // Duplicate lines are summed, so the per-line cap cannot be dodged by sending
  // the same item twenty times.
  const wanted = new Map();
  for (const item of items) {
    const id = String(item?.cinemaBeverage || item?.id || "").trim();
    const qty = Number(item?.quantity);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid item in the basket");
    }
    if (!Number.isInteger(qty) || qty < 1) {
      throw new BadRequestError("Item quantity must be a whole number of at least 1");
    }
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }
  for (const [, qty] of wanted) {
    if (qty > MAX_QUANTITY_PER_LINE) {
      throw new BadRequestError(
        `You can buy at most ${MAX_QUANTITY_PER_LINE} of any one item`
      );
    }
  }

  // Scoped to the cinema in the query itself, so a basket cannot name a cheaper
  // cinema's line-up while paying through this one's checkout.
  const rows = await CinemaBeverage.find({
    _id: { $in: [...wanted.keys()] },
    cinema: cinemaId,
  }).populate("beverage", "name image color category isActive");

  if (rows.length !== wanted.size) {
    throw new BadRequestError("One of those items is not sold at this cinema");
  }

  const lines = rows.map((row) => {
    const qty = wanted.get(String(row._id));
    if (!row.isAvailable || !row.beverage?.isActive) {
      throw new BadRequestError(
        `${row.beverage?.name || "That item"} is not currently on sale`
      );
    }
    if (!row.unlimitedStock) {
      const left = Math.max(row.stockTotal - row.sold, 0);
      if (left < qty) {
        throw new BadRequestError(
          left === 0
            ? `${row.beverage.name} is sold out`
            : `Only ${left} left of ${row.beverage.name}`
        );
      }
    }
    return {
      cinemaBeverage: String(row._id),
      name: row.beverage.name,
      image: row.beverage.image || null,
      category: row.beverage.category || "drink",
      quantity: qty,
      // Off the line-up, never off the request.
      unitPrice: row.price,
      lineTotal: round2(row.price * qty),
    };
  });

  return { lines, total: round2(lines.reduce((sum, l) => sum + l.lineTotal, 0)) };
};

/**
 * Price a whole basket without reserving anything.
 *
 * The screen the customer reads before they commit. Deliberately separate from
 * startCheckout so opening the snacks step, changing a quantity, or going back
 * to the seat picker does not take a lock on the best seats in the house.
 */
const priceBasket = async ({ showtimeId, seatKeys, ticketTypeId, quantity, concessions }) => {
  if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
    throw new NotFoundError("Showtime not found");
  }

  const showtime = await CinemaShowtime.findById(showtimeId).populate(
    "movie",
    "title poster publicationStatus"
  );
  if (!showtime) throw new NotFoundError("Showtime not found");
  if (showtime.status !== "scheduled") {
    throw new BadRequestError("That screening is not on sale");
  }
  if (!showtime.isPublished) throw new NotFoundError("Showtime not found");
  if (showtime.startsAt <= new Date()) {
    throw new BadRequestError("That screening has already started");
  }
  // The admin publication gate, enforced here as well as in issueTicket: a
  // customer must not be able to reach payment for a film that will refuse to
  // issue a ticket at the end of it.
  if (showtime.movie?.publicationStatus !== "published") {
    throw new BadRequestError("That film is not on sale yet");
  }

  const hall = await CinemaHall.findById(showtime.hall);
  if (!hall) throw new NotFoundError("Showtime not found");

  const tickets = await priceTickets({
    showtime,
    hall,
    seatKeys,
    ticketTypeId,
    quantity,
  });
  const snacks = await priceConcessions({
    cinemaId: showtime.cinema,
    items: concessions,
  });

  return {
    showtimeId: String(showtime._id),
    cinemaId: String(showtime.cinema),
    movieTitle: showtime.movie?.title,
    startsAt: showtime.startsAt,
    assignedSeating: hall.hasAssignedSeating,
    currency: showtime.currency || "ETB",
    tickets: tickets.lines,
    ticketTotal: tickets.total,
    concessions: snacks.lines,
    concessionTotal: snacks.total,
    // The figure the caller MUST charge. Never recomputed by the client, and
    // re-derived server-side at settlement so a stale basket cannot underpay.
    total: round2(tickets.total + snacks.total),
  };
};

/**
 * Price a basket AND lock its seats, ready to be paid for.
 *
 * The seats are held under `reference`, which the payment record carries, so
 * settlement can confirm exactly this order's seats and a failure can release
 * exactly this order's seats. On an unassigned hall nothing is held — there is
 * no specific chair to hold — and the tier counter alone guards the room.
 */
const startCheckout = async ({
  showtimeId,
  seatKeys,
  ticketTypeId,
  quantity,
  concessions,
  reference,
}) => {
  if (!reference) throw new BadRequestError("A checkout reference is required");

  const basket = await priceBasket({
    showtimeId,
    seatKeys,
    ticketTypeId,
    quantity,
    concessions,
  });

  if (basket.total <= 0) {
    // A free basket has nothing for a payment provider to do, and letting one
    // through would create a payment that can never settle.
    throw new BadRequestError("There is nothing to pay for");
  }

  let hold = null;
  if (basket.assignedSeating) {
    hold = await seatService.holdSeats({
      showtimeId,
      seatKeys: basket.tickets.map((t) => t.seatKey),
      reference,
    });
  }

  return {
    ...basket,
    reference,
    // What the customer has, and until when. Surfaced so the checkout page can
    // show a countdown rather than failing silently when the hold lapses.
    expiresAt: hold?.expiresAt || null,
  };
};

module.exports = {
  MAX_SEATS_PER_ORDER,
  MAX_CONCESSION_LINES,
  MAX_QUANTITY_PER_LINE,
  priceTickets,
  priceConcessions,
  priceBasket,
  startCheckout,
};
