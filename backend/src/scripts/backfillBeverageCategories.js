const mongoose = require("mongoose");

// A dry run must be genuinely read-only — Mongoose builds indexes on first
// model use, and that is a write.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Beverage = require("../models/Beverage");

// Give every catalogue row a category.
//
// Beverage.category was added with concessions and carries `default: "drink"`,
// documented there as making "every row that predates this field read
// correctly". It does not: a Mongoose default applies when a document is
// CREATED, never to rows that already exist. Every beverage created before the
// field was added therefore sits at null.
//
// The visible effects: the drink/snack/combo label renders blank everywhere a
// catalogue item is shown, and `?category=drink` matches none of them — so a
// cinema filtering its catalogue for snacks sees an empty list even when the
// products are there.
//
//   node src/scripts/backfillBeverageCategories.js            # report
//   node src/scripts/backfillBeverageCategories.js --write    # apply
//
// DRY RUN BY DEFAULT. Idempotent: only rows with no category are touched, so a
// product an admin has since marked as a snack is never reset to a drink.

const args = process.argv.slice(2);
const WRITE = args.includes("--write");

// null AND absent both count as "never set". The field is null rather than
// missing on these rows, so an `$exists: false` filter alone would match
// nothing and the script would silently report success having done nothing.
const UNSET = { $or: [{ category: { $exists: false } }, { category: null }] };

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to connect to.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(WRITE ? "MODE: WRITE" : "MODE: dry run — nothing will be written");

  const byCategory = await Beverage.aggregate([
    { $group: { _id: "$category", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);

  console.log("\n  current categories:");
  byCategory.forEach((row) =>
    console.log(`    ${String(row._id ?? "(never set)").padEnd(14)} ${String(row.n).padStart(5)}`)
  );

  const toFix = await Beverage.countDocuments(UNSET);
  console.log(`\n  rows to set to "drink": ${toFix}\n`);

  if (toFix === 0) {
    console.log("Nothing to do — every beverage already has a category.\n");
    await mongoose.disconnect();
    return;
  }

  const sample = await Beverage.find(UNSET).select("name").limit(10).lean();
  console.log("  a sample of what changes:");
  sample.forEach((b) => console.log(`    ${b.name}`));
  if (toFix > sample.length) console.log(`    ... and ${toFix - sample.length} more`);
  console.log();

  if (!WRITE) {
    console.log("Dry run — nothing written. Re-run with --write to apply.");
    console.log('These become "drink", which is what the schema default already intended.\n');
    await mongoose.disconnect();
    return;
  }

  const result = await Beverage.updateMany(UNSET, { $set: { category: "drink" } });
  console.log(`Set ${result.modifiedCount} beverage(s) to "drink".`);
  console.log("Reclassify any that are actually snacks or combos from the admin catalogue.\n");

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nbackfillBeverageCategories failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
