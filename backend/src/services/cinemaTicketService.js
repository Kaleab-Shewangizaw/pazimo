const mongoose = require("mongoose");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaTicket = require("../models/CinemaTicket");
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

  const { tier } = await claimSeats({
    showtimeId,
    ticketTypeId,
    quantity: requested,
  });

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
      // commissionRate and cinemaVatRate are snapshotted by the model hook.
    });

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
