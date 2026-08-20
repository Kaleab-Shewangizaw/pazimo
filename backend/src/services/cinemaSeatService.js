const mongoose = require("mongoose");
const CinemaHall = require("../models/CinemaHall");
const CinemaSeatHold = require("../models/CinemaSeatHold");
const CinemaShowtime = require("../models/CinemaShowtime");
const { BadRequestError, NotFoundError } = require("../errors");

// Seat selection: who may sit where, and who got there first.
//
// THE ONE HARD PROBLEM
//
// Two people click K7 at the same instant, and a payment then takes minutes to
// settle. Both facts have to hold at once: the seat must be locked the moment
// it is chosen, and the lock must not last for ever if the buyer walks away.
//
// The lock is a unique index on (showtime, seatKey) in CinemaSeatHold, so a
// claim is an INSERT and MongoDB's uniqueness guarantee is the mutual
// exclusion. There is no read-then-write and therefore no window between them.
// The release is a TTL index on expiresAt, so an abandoned checkout frees its
// seats with no sweeper to run — or to forget to run.
//
// WHY NOT REUSE THE TIER COUNTER
//
// cinemaTicketService.claimSeats increments `ticketTypes.$.sold`, which is
// correct for a hall that sells by capacity: it answers "is there a seat left"
// without caring which. It cannot answer "is K7 left". Assigned seating needs
// both — the counter still guards the tier's total, and the hold guards the
// specific chair — so the checkout does the two in order and this file owns the
// second.

// How long a seat stays held while a customer pays.
//
// Long enough for a real payment: a Telebirr or Chapa redirect, a customer
// finding their phone, a slow network. Short enough that an abandoned basket
// does not sit on the best seats in the house through a whole screening.
const HOLD_MINUTES = 10;

/** The identity every layer agrees on. One definition, so none can drift. */
const seatKeyOf = (row, number) => `${row}-${number}`;

/**
 * The hall's map plus what is currently taken, ready for a picker to render.
 *
 * Returns every seat including gaps and blocked ones: a picker has to draw the
 * aisle to be readable, and a house seat has to appear as unavailable rather
 * than as a hole in the row.
 */
const getSeatMapForShowtime = async (showtimeId) => {
  if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
    throw new NotFoundError("Showtime not found");
  }

  const showtime = await CinemaShowtime.findById(showtimeId)
    .populate("hall")
    .lean({ virtuals: false });
  if (!showtime) throw new NotFoundError("Showtime not found");

  const hall = showtime.hall;
  if (!hall?.hasAssignedSeating) {
    // Not an error: this screening sells by capacity, and the caller needs to
    // know that rather than receive an empty map it would render as a sold-out
    // room.
    return { assignedSeating: false, showtimeId: String(showtimeId) };
  }

  // Only rows that are still live matter. An expired hold may not have been
  // reaped yet — the TTL monitor runs about once a minute — so expiry is
  // checked here too rather than trusted to have already happened.
  const now = new Date();
  const taken = await CinemaSeatHold.find({
    showtime: showtimeId,
    $or: [{ status: "sold" }, { expiresAt: { $gt: now } }],
  })
    .select("seatKey status")
    .lean();

  const takenByKey = new Map(taken.map((t) => [t.seatKey, t.status]));

  // Price per category, from the showtime's tiers. This is what makes the
  // picker able to show "VIP · 400 ETB" on the seat itself.
  const priceByCategory = new Map();
  for (const tier of showtime.ticketTypes || []) {
    if (tier.seatCategoryKey) {
      priceByCategory.set(tier.seatCategoryKey, {
        ticketTypeId: String(tier._id),
        name: tier.name,
        price: tier.price,
        isAvailable: tier.isAvailable,
      });
    }
  }

  const categories = (hall.seatCategories || []).map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    ...(priceByCategory.get(c.key) || {}),
  }));

  const rows = (hall.seatMap?.rows || []).map((row) => ({
    label: row.label,
    curve: row.curve || 0,
    offset: row.offset || 0,
    seats: (row.seats || []).map((seat) => {
      const seatKey = seatKeyOf(row.label, seat.number);
      const takenStatus = takenByKey.get(seatKey);
      return {
        number: seat.number,
        seatKey,
        categoryKey: seat.categoryKey,
        exists: seat.exists,
        // One field the picker can act on, rather than three it has to combine
        // and could combine differently from the server.
        status: !seat.exists
          ? "gap"
          : seat.blocked
            ? "blocked"
            : takenStatus === "sold"
              ? "sold"
              : takenStatus === "held"
                ? "held"
                : "available",
      };
    }),
  }));

  return {
    assignedSeating: true,
    showtimeId: String(showtimeId),
    currency: showtime.currency || "ETB",
    holdMinutes: HOLD_MINUTES,
    categories,
    rows,
  };
};

/**
 * Take the named seats, or take none of them.
 *
 * All-or-nothing on purpose: a party of four told "you got three of the four
 * you picked" is a worse outcome than being told to pick again, and leaves the
 * caller to unwind a partial claim it did not ask for. Anything already
 * inserted before a clash is rolled back here.
 *
 * `reference` ties the group together so payment success or failure can act on
 * all of them at once.
 */
const holdSeats = async ({ showtimeId, seatKeys, reference, holdMinutes = HOLD_MINUTES }) => {
  if (!Array.isArray(seatKeys) || seatKeys.length === 0) {
    throw new BadRequestError("Pick at least one seat");
  }

  const unique = [...new Set(seatKeys.map((k) => String(k).trim()))];
  if (unique.length !== seatKeys.length) {
    throw new BadRequestError("The same seat was selected twice");
  }

  const showtime = await CinemaShowtime.findById(showtimeId).populate("hall");
  if (!showtime) throw new NotFoundError("Showtime not found");
  if (showtime.status !== "scheduled") {
    throw new BadRequestError("That screening is not on sale");
  }
  const hall = showtime.hall;
  if (!hall?.hasAssignedSeating) {
    throw new BadRequestError("That screening does not use assigned seating");
  }

  // Resolved from the hall's own map, never from the request: the caller says
  // WHICH seat, and the server says what that seat is and what category it is
  // in — the same rule pricing follows.
  const byKey = new Map(hall.sellableSeats().map((s) => [s.seatKey, s]));
  const seats = unique.map((key) => {
    const seat = byKey.get(key);
    if (!seat) {
      // Covers unknown, gap and blocked alike. Deliberately one message: a
      // caller probing keys should not learn the room's shape from the errors.
      throw new BadRequestError(`Seat ${key} cannot be booked`);
    }
    return seat;
  });

  const expiresAt = new Date(Date.now() + holdMinutes * 60_000);
  const held = [];

  try {
    for (const seat of seats) {
      // One insert per seat rather than insertMany: insertMany with ordered
      // stops at the first failure and reports it, but the successful ones are
      // already written and would need the same unwind — and unordered would
      // scatter partial claims across the row. This way the failure point is
      // unambiguous.
      const doc = await CinemaSeatHold.create({
        showtime: showtime._id,
        cinema: showtime.cinema,
        seatKey: seat.seatKey,
        row: seat.row,
        number: seat.number,
        categoryKey: seat.categoryKey,
        status: "held",
        expiresAt,
        reference,
      });
      held.push(doc);
    }
  } catch (error) {
    // Give back anything this call managed to take before the clash.
    await CinemaSeatHold.deleteMany({
      _id: { $in: held.map((h) => h._id) },
    }).catch(() => {});

    if (error?.code === 11000) {
      throw new BadRequestError(
        "Someone just took one of those seats. Please pick again."
      );
    }
    throw error;
  }

  return {
    reference,
    expiresAt,
    seats: held.map((h) => ({
      seatKey: h.seatKey,
      row: h.row,
      number: h.number,
      categoryKey: h.categoryKey,
    })),
  };
};

/**
 * Hand the seats back.
 *
 * Only ever deletes rows that are still `held`. A sold seat is not this
 * function's to release — that is a refund, which has to return money as well
 * as a chair, and deleting the row here would silently unbook a paid customer.
 */
const releaseHolds = async (reference) => {
  const result = await CinemaSeatHold.deleteMany({ reference, status: "held" });
  return result.deletedCount;
};

/**
 * Turn a held seat into a sold one.
 *
 * Clearing expiresAt is what makes it permanent: the TTL index ignores null, so
 * the row stops being a countdown and becomes the record that this seat is
 * gone. Matching on status "held" makes it idempotent — a webhook that fires
 * twice confirms once and the second call matches nothing.
 */
const confirmHold = async ({ reference, seatKey, ticketId }) => {
  const confirmed = await CinemaSeatHold.findOneAndUpdate(
    { reference, seatKey, status: "held" },
    { $set: { status: "sold", expiresAt: null, ticket: ticketId } },
    { new: true }
  );
  return confirmed;
};

/** Release a sold seat on refund, so it can be sold again. */
const releaseSoldSeat = async ({ showtimeId, seatKey }) => {
  await CinemaSeatHold.deleteOne({
    showtime: showtimeId,
    seatKey,
    status: "sold",
  });
};

module.exports = {
  HOLD_MINUTES,
  seatKeyOf,
  getSeatMapForShowtime,
  holdSeats,
  releaseHolds,
  confirmHold,
  releaseSoldSeat,
};
