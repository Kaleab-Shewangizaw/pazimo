const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);
const CinemaTicket = require("../models/CinemaTicket");

/**
 * Backfill CinemaTicket.seats for every ticket written before a ticket could
 * cover more than one seat.
 *
 * CinemaTicket.seat (singular) was replaced by CinemaTicket.seats (array) on
 * 2026-09-06 so a checkout of several same-category seats produces one
 * ticket instead of one per seat. Any ticket sold before that change still
 * has the old `seat` field in the database and no `seats` — this wraps it,
 * `seats: [seat]`, so every reader that now expects an array sees one.
 *
 * A ticket with neither field (an unassigned-hall/general-admission sale)
 * needs no change and is left alone.
 *
 * DRY RUN BY DEFAULT.
 *
 *   node src/scripts/backfillCinemaTicketSeats.js
 *   node src/scripts/backfillCinemaTicketSeats.js -- --write
 */

const WRITE = process.argv.includes("--write");

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to connect to.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(WRITE ? "MODE: WRITE" : "MODE: dry run — nothing will be written");

  // Raw collection, not the model — the model's schema no longer declares
  // `seat`, so a Mongoose query wouldn't see it even though the stored
  // document still can.
  const collection = CinemaTicket.collection;
  const cursor = collection.find(
    { "seat.seatKey": { $exists: true, $ne: null }, seats: { $exists: false } },
    { projection: { seat: 1 } }
  );

  let scanned = 0;
  for await (const doc of cursor) {
    scanned += 1;
    if (WRITE) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { seats: [doc.seat] }, $unset: { seat: "" } }
      );
    }
  }

  console.log(`\n  tickets with a pre-migration singular seat : ${scanned}`);
  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.\n");
  } else {
    console.log(`\nWrapped seat -> seats on ${scanned} ticket(s).\n`);
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
