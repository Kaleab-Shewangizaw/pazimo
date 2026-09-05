const CinemaTicket = require("../models/CinemaTicket");
const CinemaShowtime = require("../models/CinemaShowtime");
const cinemaTicketService = require("./cinemaTicketService");
const cinemaBeverageSalesService = require("./cinemaBeverageSalesService");
const seatService = require("./cinemaSeatService");
const notificationService = require("./cinemaNotificationService");

// Turning a paid cinema order into tickets and snacks.
//
// Runs from the payment webhook, so the rules that matter here are the ones
// that survive a webhook firing twice, firing late, or racing the poller:
//
//   IDEMPOTENT   — the same payment settled twice must produce one set of
//                  tickets, not two. Guarded by looking for tickets already
//                  written against this reference before doing anything.
//   TOTAL         — a customer who paid for four seats and two popcorns must
//                  never end up with the seats and no popcorn silently. A
//                  concession that cannot be fulfilled is RECORDED as failed on
//                  the result so it can be refunded or handed over at the
//                  counter, never swallowed.
//   NEVER LOSES A SEAT — the seat was already held at basket time. Settlement
//                  confirms that hold rather than claiming a new one, so a slow
//                  payment cannot arrive to find its seat resold.
//
// The order is deliberate: tickets first, snacks second. A ticket is the thing
// the customer came for and the thing that cannot be handed over at the
// counter afterwards; popcorn can.

/**
 * Settle one paid cinema order.
 *
 * `order` is what the checkout stored on the payment: the priced basket, with
 * the reference its seats are held under. Prices are NOT recomputed here — the
 * customer has already been charged the basket's total, so re-deriving could
 * only produce a figure that disagrees with the money actually taken.
 */
const settleCinemaOrder = async ({ order, reference, customer, customerName, customerPhone, customerEmail }) => {
  // Idempotency gate. A webhook and a poll can both arrive; whichever is second
  // finds the tickets already written and returns them rather than issuing a
  // second set against the same payment.
  const existing = await CinemaTicket.find({ paymentReference: reference }).lean();
  if (existing.length) {
    return { tickets: existing, concessions: [], alreadySettled: true };
  }

  const showtime = await CinemaShowtime.findById(order.showtimeId).lean();
  if (!showtime) {
    throw new Error(`Showtime ${order.showtimeId} vanished before settlement`);
  }

  const tickets = [];
  const failedTickets = [];

  for (const line of order.tickets) {
    const seats = Array.isArray(line.seats) ? line.seats : [];
    try {
      const ticket = await cinemaTicketService.issueTicket({
        showtimeId: order.showtimeId,
        ticketTypeId: line.ticketTypeId,
        quantity: line.quantity ?? 1,
        customer,
        customerName,
        customerPhone,
        customerEmail,
        channel: "online",
        paymentReference: reference,
        paymentStatus: "completed",
        cinemaId: showtime.cinema,
        // The seats this line covers, when there are any — issueTicket writes
        // them onto the ticket as a snapshot and confirms each one's hold.
        seats: seats.map((seat) => ({
          seatKey: seat.seatKey,
          row: seat.row,
          number: seat.number,
          categoryKey: seat.categoryKey,
          categoryLabel: seat.categoryLabel,
        })),
        // Every seat here was locked at basket time under this reference;
        // issueTicket confirms those holds instead of taking new ones.
        seatHoldReference: seats.length ? reference : undefined,
        // Already checked at basket time. Re-checking here would let an admin
        // un-publishing a film during a redirect strand a customer who has
        // already paid, with a charge and no ticket.
        requirePublished: false,
      });
      tickets.push(ticket);
    } catch (error) {
      // Recorded, never swallowed. The customer has paid; someone has to know
      // this line did not materialise.
      const seatDescr = seats.length
        ? seats.map((s) => s.seatKey).join(",")
        : line.ticketType;
      console.error(
        `[CINEMA-SETTLE] ticket failed for ${reference} (${seatDescr}): ${error.message}`
      );
      failedTickets.push({ line, reason: error.message });
    }
  }

  // Snacks second: a drink that sold out between checkout and settlement is
  // recoverable at the counter, a seat is not.
  const concessions = [];
  const failedConcessions = [];

  for (const line of order.concessions || []) {
    try {
      const sale = await cinemaBeverageSalesService.recordSale({
        cinemaBeverageId: line.cinemaBeverage,
        quantity: line.quantity,
        customer,
        customerName,
        customerPhone,
        channel: "online",
        paymentReference: reference,
        showtimeId: order.showtimeId,
        cinemaId: showtime.cinema,
      });
      concessions.push(sale);
    } catch (error) {
      console.error(
        `[CINEMA-SETTLE] concession failed for ${reference} ${line.name}: ${error.message}`
      );
      failedConcessions.push({ line, reason: error.message });
    }
  }

  if (failedTickets.length || failedConcessions.length) {
    // Loud, and with the reference, because this is money taken for something
    // not delivered — it needs a human, and the refund path does not exist yet
    // (PAZIMO_PLAN P4).
    console.error(
      `[CINEMA-SETTLE] ⚠️ ORDER ${reference} PARTIALLY FULFILLED — ` +
        `${failedTickets.length} ticket(s) and ${failedConcessions.length} item(s) failed. ` +
        `The customer has been charged. This needs a refund or a manual hand-over.`
    );
  }

  // Anything still merely held under this reference is released: an unsold seat
  // must not stay locked for the rest of the screening because one line failed.
  // Confirmed seats are already "sold" and are not touched by this.
  await seatService.releaseHolds(reference).catch(() => {});

  // Tell the customer, once the tickets actually exist.
  //
  // Deliberately after everything above and deliberately not awaited for
  // correctness: the tickets are already readable from the order page and from
  // /ticket/{id}, so a slow SMS gateway must not hold the webhook open and a
  // failed send must never look like a failed sale. One message per order.
  if (tickets.length) {
    notificationService
      .sendCinemaOrderConfirmation({
        tickets,
        concessions,
        reference,
        customerName,
        customerPhone,
        customerEmail,
      })
      .catch((error) =>
        console.error(
          `[CINEMA-SETTLE] confirmation failed for ${reference}: ${error.message}`
        )
      );
  }

  return {
    tickets,
    concessions,
    failedTickets,
    failedConcessions,
    alreadySettled: false,
  };
};

module.exports = { settleCinemaOrder };
