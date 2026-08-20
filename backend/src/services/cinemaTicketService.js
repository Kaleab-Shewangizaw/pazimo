const mongoose = require("mongoose");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaTicket = require("../models/CinemaTicket");
const CinemaHall = require("../models/CinemaHall");
const seatService = require("./cinemaSeatService");
const { BadRequestError, NotFoundError } = require("../errors");
const { mirrorSale } = require("./ledgerDualWrite");

// Cinema ticket issuing.
//
// Sales are recorded here rather than in the controller so a payment webhook can
// call issueTickets() directly, server-side, without going back out through
// HTTP — the same reason the concession services exist.
//
// Every write targets CinemaShowtime / CinemaTicket. There is no code path
// through which an event id or an organizer id can reach a cinema ticket, or the
// reverse: the two ledgers are different collections and nothing joins them.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Claim seats on one tier of one screening, atomically.
 *
 * The guard is a single findOneAndUpdate: the "are there seats left?" comparison
 * and the increment happen in one operation, so two buyers landing at the same
 * moment cannot both take the last seat. A read-then-write here would oversell
 * under exactly the load a popular opening night produces.
 *
 * The capacity comparison is written as `sold <= allocation - requested` with the
 * allocation read a moment earlier, rather than as a two-field $expr comparison,
 * because $expr is not permitted inside $elemMatch and the positional `$` needs
 * an $elemMatch to know which tier to increment. The consequence is narrow and
 * worth stating: if an admin re-allocates the tier between the read and the
 * write, this claim is evaluated against the previous allocation. That is an
 * admin action racing a single purchase, not buyers racing each other — and the
 * `sold` value it compares against is always the live one, so the guard still
 * cannot oversell relative to the allocation it saw.
 */
const claimSeats = async ({ showtimeId, ticketTypeId, quantity }) => {
  const showtime = await CinemaShowtime.findById(showtimeId);
  if (!showtime) throw new NotFoundError("Showtime not found");
  if (showtime.status !== "scheduled") {
    throw new BadRequestError("That screening is not on sale");
  }

  const tier = showtime.ticketTypes.id(ticketTypeId);
  if (!tier) throw new NotFoundError("Ticket type not found for that screening");
  if (!tier.isAvailable) {
    throw new BadRequestError(`${tier.name} is not currently on sale`);
  }

  const ceiling = tier.allocation - quantity;
  if (ceiling < 0) {
    throw new BadRequestError(
      `Only ${Math.max(tier.allocation - tier.sold, 0)} ${tier.name} seats left`
    );
  }

  const claimed = await CinemaShowtime.findOneAndUpdate(
    {
      _id: showtime._id,
      status: "scheduled",
      ticketTypes: {
        $elemMatch: {
          _id: tier._id,
          isAvailable: true,
          sold: { $lte: ceiling },
        },
      },
    },
    { $inc: { "ticketTypes.$.sold": quantity } },
    { new: true }
  );

  if (!claimed) {
    const remaining = Math.max(tier.allocation - tier.sold, 0);
    throw new BadRequestError(
      remaining === 0
        ? `${tier.name} is sold out for this screening`
        : `Only ${remaining} ${tier.name} seats left`
    );
  }

  return { showtime: claimed, tier: claimed.ticketTypes.id(tier._id) };
};

/** Give seats back — used when the ledger write fails, and on refund. */
const releaseSeats = async ({ showtimeId, ticketTypeId, quantity }) => {
  await CinemaShowtime.updateOne(
    {
      _id: showtimeId,
      // Never let the counter go below zero, whatever the row's history.
      ticketTypes: { $elemMatch: { _id: ticketTypeId, sold: { $gte: quantity } } },
    },
    { $inc: { "ticketTypes.$.sold": -quantity } }
  );
};

/**
 * Issue a cinema ticket for one tier of one screening.
 *
 * Prices are resolved from the showtime server-side and never taken from the
 * caller — the client says WHAT it wants, never what it costs, the same rule
 * concessionBasketService enforces for baskets.
 */
const issueTicket = async ({
  showtimeId,
  ticketTypeId,
  quantity = 1,
  customer,
  customerName,
  customerPhone,
  customerEmail,
  channel = "box_office",
  paymentReference,
  paymentStatus = "completed",
  // Optional. When set, the screening must belong to this cinema or the sale is
  // refused — the guard that stops a caller selling seats for a cinema it does
  // not own by passing someone else's showtime id.
  cinemaId,
  // Whether the film must have cleared the admin publication gate.
  //
  // DEFAULTS TO TRUE, so every future caller is gated unless it deliberately
  // says otherwise. The one caller that opts out is the box office: a member of
  // cinema staff selling a seat to a person standing in front of them is not
  // the public surface the gate governs, and letting an admin review backlog
  // stop a real cinema trading would be a worse failure than an unlisted film
  // selling a counter ticket.
  requirePublished = true,
  // The seat this ticket admits, on a hall with assigned seating. Resolved by
  // the checkout from the hall's own map — never taken from a request body.
  seat,
  // When set, the seat was already locked under this reference at basket time
  // and is CONFIRMED here rather than claimed again. Claiming again would fail
  // against the hold this very order placed.
  seatHoldReference,
}) => {
  if (!mongoose.Types.ObjectId.isValid(showtimeId)) {
    throw new NotFoundError("Showtime not found");
  }
  if (!mongoose.Types.ObjectId.isValid(ticketTypeId)) {
    throw new NotFoundError("Ticket type not found for that screening");
  }

  const requested = Number(quantity);
  if (!Number.isInteger(requested) || requested < 1) {
    throw new BadRequestError("quantity must be a whole number of at least 1");
  }

  const preview = await CinemaShowtime.findById(showtimeId)
    .select("cinema movie hall startsAt status")
    .populate("movie", "title publicationStatus isActive")
    .populate("hall", "name")
    .lean();
  if (!preview) throw new NotFoundError("Showtime not found");
  if (cinemaId && String(preview.cinema) !== String(cinemaId)) {
    // "Not found" rather than "forbidden": probing ids should not confirm what
    // exists at another cinema.
    throw new NotFoundError("Showtime not found");
  }

  // Checked BEFORE seats are claimed, so a refused sale never has to give a
  // seat back — the claim/release dance below exists for failures that can only
  // be discovered after the claim, and this is not one of them.
  if (requirePublished && preview.movie?.publicationStatus !== "published") {
    throw new BadRequestError(
      "This film is not published yet, so tickets cannot be sold for it online."
    );
  }

  // A hall with assigned seating sells CHAIRS, so every sale through it must
  // name one — including at the box office.
  //
  // Without this, a counter sale would increment the tier counter without
  // taking a seat lock, and could hand out a chair an online customer is at
  // that moment paying for. The tier counter guards how many; only the seat
  // hold guards which.
  // preview.hall is populated, so it is a document rather than an id.
  const hallId = preview.hall?._id || preview.hall;
  const hall = await CinemaHall.findById(hallId)
    .select("hasAssignedSeating")
    .lean();

  if (hall?.hasAssignedSeating && !seat?.seatKey) {
    throw new BadRequestError(
      "This hall has assigned seating, so a seat must be chosen for every ticket"
    );
  }
  if (seat?.seatKey && requested !== 1) {
    // One chair, one ticket. A quantity above 1 against a named seat would mean
    // several people in one chair.
    throw new BadRequestError("A named seat admits exactly one ticket");
  }

  const { tier } = await claimSeats({
    showtimeId,
    ticketTypeId,
    quantity: requested,
  });

  // Lock the specific chair. Either confirm the hold this order already placed,
  // or take one now for a walk-in at the counter who never had a basket.
  let confirmedHold = null;
  if (seat?.seatKey) {
    try {
      if (seatHoldReference) {
        confirmedHold = await seatService.confirmHold({
          reference: seatHoldReference,
          seatKey: seat.seatKey,
          ticketId: undefined,
        });
        if (!confirmedHold) {
          // The hold lapsed or was never taken. Refusing is the only safe
          // answer: issuing anyway would hand out a seat the lock no longer
          // covers, which is precisely what the lock exists to prevent.
          throw new BadRequestError(
            `The hold on seat ${seat.seatKey} has expired. Please pick again.`
          );
        }
      } else {
        // A walk-in at the counter: no basket, so no existing hold. Take one and
        // confirm it immediately — the pair is what makes the chair unavailable
        // to the online picker from this instant.
        //
        // The reference is computed ONCE and used for both calls. Deriving it
        // twice (or falling back differently in each) would confirm a different
        // reference than was held and leave the seat locked but unsold.
        const counterReference =
          paymentReference || `boxoffice:${Date.now()}:${seat.seatKey}`;
        await seatService.holdSeats({
          showtimeId,
          seatKeys: [seat.seatKey],
          reference: counterReference,
        });
        confirmedHold = await seatService.confirmHold({
          reference: counterReference,
          seatKey: seat.seatKey,
          ticketId: undefined,
        });
      }
    } catch (error) {
      // The tier counter was already incremented above, so it has to come back
      // before this throws — otherwise a failed seat lock permanently shrinks
      // the tier.
      await releaseSeats({
        showtimeId,
        ticketTypeId: tier._id,
        quantity: requested,
      });
      throw error;
    }
  }

  try {
    const ticket = await CinemaTicket.create({
      cinema: preview.cinema,
      showtime: showtimeId,
      movie: preview.movie?._id || preview.movie,
      hall: preview.hall?._id || preview.hall,
      movieTitle: preview.movie?.title || "Untitled",
      hallName: preview.hall?.name,
      showtimeStartsAt: preview.startsAt,
      ticketTypeId: tier._id,
      ticketType: tier.name,
      price: tier.price,
      quantity: requested,
      totalAmount: round2(tier.price * requested),
      customer: customer || undefined,
      customerName,
      customerPhone,
      customerEmail,
      channel,
      paymentReference,
      paymentStatus,
      paymentDate: paymentStatus === "completed" ? new Date() : undefined,
      // A SNAPSHOT of the chair, not a reference to it. The hall's map is a
      // living document; a sold ticket must keep saying "Row K, seat 7, VIP"
      // after the room is re-tiered, and the door cannot depend on the map
      // still describing the room as it was at purchase.
      seat: seat?.seatKey ? seat : undefined,
      // commissionRate and cinemaVatRate are snapshotted by the model hook.
    });

    // Point the seat lock at the ticket it became, so a refund can find the row
    // to release. Best effort: the ticket is the record that matters, and a
    // missing back-reference is recoverable from the ticket's own seatKey.
    if (confirmedHold) {
      await seatService
        .attachTicketToHold({ holdId: confirmedHold._id, ticketId: ticket._id })
        .catch((error) =>
          console.error(
            `[CINEMA] could not link seat hold ${confirmedHold._id} to ticket ${ticket._id}: ${error.message}`
          )
        );
    }

    // Mirror into the ledger, after the ticket exists. mirrorSale swallows its
    // own errors — a ledger failure must never fail a paid sale while the
    // ledger is still a shadow copy — so awaiting it here cannot reach the
    // catch below and release seats a customer has paid for. The rates come off
    // the saved ticket, not from here, so the ledger records exactly what was
    // charged.
    if (ticket.paymentStatus === "completed") {
      await mirrorSale({
        owner: { kind: "cinema", id: ticket.cinema },
        stream: "tickets",
        grossAmount: ticket.totalAmount,
        commissionRate: ticket.commissionRate,
        ownerVatRate: ticket.cinemaVatRate,
        source: { cinemaTicket: ticket._id },
        reference: `cinema_ticket:${ticket._id}`,
        occurredAt: ticket.purchaseDate,
      });
    }

    return ticket;
  } catch (error) {
    // The seats were already claimed above. If the ledger write fails they must
    // go back, or they are lost to a ticket that does not exist.
    await releaseSeats({
      showtimeId,
      ticketTypeId: tier._id,
      quantity: requested,
    });
    // And the chair with them: a confirmed hold whose ticket never got written
    // would lock that seat for the rest of the screening with nothing to show
    // for it.
    if (confirmedHold) {
      await seatService
        .releaseSoldSeat({ showtimeId, seatKey: confirmedHold.seatKey })
        .catch(() => {});
    }
    throw error;
  }
};

/**
 * Refund a cinema ticket: return the seats and take it out of revenue, but keep
 * the row — a refund is history, not an erasure.
 */
const refundTicket = async (ticketId, { adminId, reason } = {}) => {
  const ticket = await CinemaTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError("Ticket not found");
  if (ticket.status === "refunded") {
    throw new BadRequestError("That ticket is already refunded");
  }
  if (ticket.checkedIn) {
    throw new BadRequestError("That ticket has already been used");
  }

  ticket.status = "refunded";
  ticket.refundedAt = new Date();
  if (adminId) ticket.refundedBy = adminId;
  if (reason) ticket.refundReason = reason;
  await ticket.save();

  await releaseSeats({
    showtimeId: ticket.showtime,
    ticketTypeId: ticket.ticketTypeId,
    quantity: ticket.quantity,
  });

  return ticket;
};

/**
 * Admit the holder of a ticket.
 *
 * `cinemaId` is required by every caller: a cinema may only validate tickets for
 * its own screenings, so the check is part of the lookup rather than something a
 * route is trusted to have done. Passing a foreign ticket reads as not found.
 */
const checkInTicket = async ({ ticketId, cinemaId, checkedInBy }) => {
  const ticket = await CinemaTicket.findOne({ ticketId, cinema: cinemaId });
  if (!ticket) throw new NotFoundError("Ticket not found for this cinema");

  if (ticket.status === "refunded" || ticket.status === "cancelled") {
    throw new BadRequestError(`That ticket was ${ticket.status}`);
  }
  if (ticket.paymentStatus !== "completed") {
    throw new BadRequestError("That ticket has not been paid for");
  }
  if (ticket.checkedIn) {
    throw new BadRequestError(
      `Already admitted at ${ticket.checkedAt?.toISOString() || "an earlier time"}`
    );
  }

  ticket.checkedIn = true;
  ticket.checkedAt = new Date();
  ticket.status = "used";
  if (checkedInBy) ticket.checkedInBy = checkedInBy;
  await ticket.save();

  return ticket;
};

module.exports = {
  claimSeats,
  releaseSeats,
  issueTicket,
  refundTicket,
  checkInTicket,
};
