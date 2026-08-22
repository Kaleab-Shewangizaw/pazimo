const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);

const CinemaSeatHold = require("../models/CinemaSeatHold");
const CinemaTicket = require("../models/CinemaTicket");
require("../models/CinemaShowtime");

/**
 * Make every taken seat answer for itself.
 *
 * THE INVARIANT
 *
 * A seat is unavailable for exactly one of two reasons: someone is paying for
 * it right now (a `held` row, which expires on its own), or someone has bought
 * it (a `sold` row, which must have a live ticket behind it). Anything else is
 * a chair nobody can buy and nobody owns.
 *
 * Two ways that breaks, both found by looking rather than by theory:
 *
 *   ORPHANED SEAT — a `sold` row whose ticket does not exist, or whose ticket
 *     was refunded or cancelled. The seat reads as taken for ever; the picker
 *     refuses it and the tier counter says it is free, so the last buyer is
 *     told "someone just took that seat" by a ghost.
 *
 *   UNPROTECTED TICKET — a ticket that names a seat with no `sold` row holding
 *     it. The reverse and the more dangerous one: the seat is offered to the
 *     next customer, and two people arrive holding tickets for one chair.
 *
 * DRY RUN BY DEFAULT.
 *
 *   npm run reconcile:seats
 *   npm run reconcile:seats -- --write
 */

const WRITE = process.argv.includes("--write");

// A ticket only justifies holding a seat while it is live. A refunded or
// cancelled ticket is history, and its chair belongs to the next buyer.
const LIVE_TICKET_STATUS = { $nin: ["refunded", "cancelled"] };

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to connect to.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(WRITE ? "MODE: WRITE" : "MODE: dry run — nothing will be written");

  const soldHolds = await CinemaSeatHold.find({ status: "sold" }).lean();
  const seatedTickets = await CinemaTicket.find({
    "seat.seatKey": { $exists: true, $ne: null },
    status: LIVE_TICKET_STATUS,
  })
    .select("ticketId showtime seat status paymentReference")
    .lean();

  console.log(`\n  sold seat rows        : ${soldHolds.length}`);
  console.log(`  live seated tickets   : ${seatedTickets.length}\n`);

  // Keyed by showtime+seat, which is what makes a seat unique.
  const ticketBySeat = new Map(
    seatedTickets.map((t) => [`${t.showtime}::${t.seat.seatKey}`, t])
  );
  const holdBySeat = new Map(
    soldHolds.map((h) => [`${h.showtime}::${h.seatKey}`, h])
  );

  const orphanedSeats = soldHolds.filter(
    (h) => !ticketBySeat.has(`${h.showtime}::${h.seatKey}`)
  );
  const unprotectedTickets = seatedTickets.filter(
    (t) => !holdBySeat.has(`${t.showtime}::${t.seat.seatKey}`)
  );

  if (orphanedSeats.length) {
    console.log(`  ORPHANED SEATS — taken, with no live ticket (${orphanedSeats.length}):`);
    orphanedSeats.forEach((h) =>
      console.log(
        `    ${h.seatKey.padEnd(8)} showtime ${String(h.showtime).slice(-8)}  ref ${h.reference}`
      )
    );
    console.log("    -> released, so they can be sold again\n");
  }

  if (unprotectedTickets.length) {
    console.log(`  UNPROTECTED TICKETS — a ticket whose seat is not locked (${unprotectedTickets.length}):`);
    unprotectedTickets.forEach((t) =>
      console.log(
        `    ${t.seat.seatKey.padEnd(8)} showtime ${String(t.showtime).slice(-8)}  ticket ${t.ticketId}`
      )
    );
    console.log("    -> re-locked, so the chair cannot be sold twice\n");
  }

  if (!orphanedSeats.length && !unprotectedTickets.length) {
    console.log("  Every taken seat has a live ticket, and every seated ticket holds its seat.\n");
    await mongoose.disconnect();
    return;
  }

  if (!WRITE) {
    console.log("Dry run — nothing written. Re-run with --write to apply.\n");
    await mongoose.disconnect();
    return;
  }

  let releasedCount = 0;
  for (const hold of orphanedSeats) {
    // Deleted rather than expired: there is nothing to wait for, and leaving it
    // with a past expiry would depend on the TTL sweeper to finish the job.
    await CinemaSeatHold.deleteOne({ _id: hold._id });
    releasedCount += 1;
  }

  let relockedCount = 0;
  for (const ticket of unprotectedTickets) {
    const [row, ...numberParts] = String(ticket.seat.seatKey).split("-");
    try {
      await CinemaSeatHold.create({
        showtime: ticket.showtime,
        cinema: ticket.cinema,
        seatKey: ticket.seat.seatKey,
        row: ticket.seat.row || row,
        number: ticket.seat.number || numberParts.join("-"),
        categoryKey: ticket.seat.categoryKey || "standard",
        status: "sold",
        // Null, so the TTL never reaps a seat someone has paid for.
        expiresAt: null,
        reference: ticket.paymentReference || `repair:${ticket.ticketId}`,
        ticket: ticket._id,
      });
      relockedCount += 1;
    } catch (error) {
      // A duplicate key means the seat is already locked by something else —
      // which is a genuine double-sale and needs a human, not a retry.
      console.error(
        `    could not re-lock ${ticket.seat.seatKey} for ${ticket.ticketId}: ${error.message}`
      );
    }
  }

  console.log(`Released ${releasedCount} orphaned seat(s), re-locked ${relockedCount} ticket seat(s).\n`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nreconcileCinemaSeats failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
