const mongoose = require("mongoose");

// A dry run must be genuinely read-only — same reasoning as backfillLedger.js:
// Mongoose builds indexes on first model use, and that is a write.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const CinemaMovie = require("../models/CinemaMovie");
// Required for its side effect: the sample below populates `cinema`, and
// Mongoose can only resolve a ref whose model has been registered.
require("../models/Cinema");

// Put every existing film into the admin review queue.
//
// The publication gate is new: before it, a cinema creating a film put it
// straight in front of customers. Existing rows have no publicationStatus at
// all, and the schema default only applies to documents created from now on —
// so without this they would read as `undefined`, which is not "published" and
// would therefore already be hidden, but would also never appear in a
// `publicationStatus: "pending"` queue. They would be invisible AND unreviewable.
//
// This makes that state explicit: every existing film becomes `pending`, so it
// is hidden from customers and shows up in the admin queue to be worked through.
//
//   node src/scripts/migrateCinemaMoviePublication.js            # report
//   node src/scripts/migrateCinemaMoviePublication.js --write    # apply
//   node src/scripts/migrateCinemaMoviePublication.js --write --publish-existing
//
// DRY RUN BY DEFAULT.
//
// `--publish-existing` is the other choice: grandfather everything as published
// so nothing disappears from the live site, and let the gate apply only to new
// films. It is not the default because the point of the gate is that a human
// has looked at what is on the shelf.
//
// Safe to re-run: it only touches rows whose publicationStatus is missing.
// A film an admin has already decided on is never revisited.

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const PUBLISH_EXISTING = args.includes("--publish-existing");
const TARGET = PUBLISH_EXISTING ? "published" : "pending";

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to connect to.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(WRITE ? "MODE: WRITE" : "MODE: dry run — nothing will be written");
  console.log(`Existing films will become: ${TARGET.toUpperCase()}\n`);

  // Only rows that have never been decided on. `$exists: false` and an explicit
  // null both count as undecided; anything already set is left alone so a
  // re-run cannot overwrite an admin's decision.
  const undecided = {
    $or: [
      { publicationStatus: { $exists: false } },
      { publicationStatus: null },
    ],
  };

  const [total, toChange, byStatus] = await Promise.all([
    CinemaMovie.countDocuments({}),
    CinemaMovie.countDocuments(undecided),
    CinemaMovie.aggregate([
      { $group: { _id: "$publicationStatus", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
  ]);

  console.log(`  films in total          ${String(total).padStart(6)}`);
  console.log(`  never decided on        ${String(toChange).padStart(6)}   <- what this touches`);
  console.log(`  already decided         ${String(total - toChange).padStart(6)}   <- left alone\n`);

  console.log("  current publicationStatus values:");
  byStatus.forEach((row) =>
    console.log(`    ${String(row._id ?? "(unset)").padEnd(12)} ${String(row.n).padStart(6)}`)
  );
  console.log();

  if (toChange === 0) {
    console.log("Nothing to do — every film already has a publication decision.\n");
    await mongoose.disconnect();
    return;
  }

  // What the admin will actually be looking at, so the size of the review queue
  // is known before it is created rather than discovered afterwards.
  const sample = await CinemaMovie.find(undecided)
    .populate("cinema", "name")
    .select("title cinema isActive status")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  console.log(`  a sample of what moves to ${TARGET}:`);
  sample.forEach((m) =>
    console.log(
      `    ${String(m.title).slice(0, 40).padEnd(42)} ${String(m.cinema?.name ?? "(no cinema)").slice(0, 24).padEnd(26)} ${m.status}`
    )
  );
  if (toChange > sample.length) console.log(`    ... and ${toChange - sample.length} more`);
  console.log();

  if (!WRITE) {
    console.log("Dry run — nothing written. Re-run with --write to apply.");
    if (!PUBLISH_EXISTING) {
      console.log(
        "NOTE: this hides every existing film from customers until an admin publishes it.\n" +
          "      Pass --publish-existing instead to grandfather them as live.\n"
      );
    }
    await mongoose.disconnect();
    return;
  }

  const update = { publicationStatus: TARGET };
  if (PUBLISH_EXISTING) {
    // Grandfathered, not reviewed. publishedBy is deliberately left unset —
    // no admin approved these, and recording one who did not would be a lie in
    // the audit trail.
    update.publicationNote = "Published automatically when the review gate was introduced.";
  } else {
    update.publicationNote = "Awaiting review — created before the publication gate existed.";
  }

  // updateMany, not a save() loop: this is a single field on every row, the
  // model hooks have nothing to contribute, and a loop over a large collection
  // would be slow for no benefit.
  const result = await CinemaMovie.updateMany(undecided, { $set: update });

  // Slots are public shelf space and the public rows filter on publication, so
  // an unpublished film holding one would look taken and show nothing.
  let clearedSlots = { modifiedCount: 0 };
  if (!PUBLISH_EXISTING) {
    clearedSlots = await CinemaMovie.updateMany(
      {
        publicationStatus: { $ne: "published" },
        $or: [{ bannerStatus: true }, { isFeatured: true }, { isTrending: true }],
      },
      { $set: { bannerStatus: false, isFeatured: false, isTrending: false } }
    );
  }

  console.log(`Updated ${result.modifiedCount} film(s) to ${TARGET}.`);
  if (clearedSlots.modifiedCount) {
    console.log(`Cleared display slots on ${clearedSlots.modifiedCount} unpublished film(s).`);
  }
  console.log(
    PUBLISH_EXISTING
      ? "\nExisting films are live. New films will need admin approval.\n"
      : "\nEvery existing film is now hidden from customers and waiting in the admin queue.\n"
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nmigrateCinemaMoviePublication failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
