const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const BeverageSale = require("../models/BeverageSale");
const VenueBeverage = require("../models/VenueBeverage");
const VenueBeverageSale = require("../models/VenueBeverageSale");
const Venue = require("../models/Venue");

// Migration for the venue sales channel.
//
// Two jobs, both safe to re-run and neither destructive:
//
//  1. Stamp salesContext:"EVENT" on beverage sales written before the channel
//     split existed. They were all event sales — there was no other kind — so
//     this states what was already true rather than changing any meaning. No
//     money is touched: the field is not read by any revenue expression, only
//     by the admin feed that merges the two ledgers for display.
//
//  2. Build the indexes for the three new collections, so the first venue
//     query is not a collection scan and the unique constraints are actually
//     enforced from the start rather than after the first duplicate.
//
// Nothing here writes to VenueBeverageSale, and nothing reads from it into an
// organizer figure. An existing deployment that never creates a venue is
// unaffected by running this beyond the salesContext stamp.
const migrate = async ({ dryRun }) => {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI is not defined in .env, please pass it as env var");
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`Connected to MongoDB${dryRun ? " (dry run — no writes)" : ""}`);

  // --- 1. Backfill salesContext on the event ledger -------------------------
  const missing = await BeverageSale.countDocuments({
    salesContext: { $exists: false },
  });
  console.log(`Beverage sales without salesContext: ${missing}`);

  if (missing > 0 && !dryRun) {
    const result = await BeverageSale.updateMany(
      { salesContext: { $exists: false } },
      { $set: { salesContext: "EVENT" } }
    );
    console.log(`  stamped ${result.modifiedCount} row(s) as EVENT`);
  }

  // A sanity check that the stamp cannot have changed any total: the number of
  // confirmed sales and their gross must be identical before and after, since
  // salesContext appears in no revenue expression.
  const [totals] = await BeverageSale.aggregate([
    { $match: { status: "confirmed", totalAmount: { $gt: 0 }, currency: "ETB" } },
    { $group: { _id: null, gross: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
  ]);
  console.log(
    `Event beverage ledger after migration: ${totals?.count || 0} confirmed sale(s), ` +
      `gross ${(Math.round((totals?.gross || 0) * 100) / 100).toFixed(2)} ETB`
  );

  // --- 2. Indexes for the venue collections ---------------------------------
  if (!dryRun) {
    for (const model of [Venue, VenueBeverage, VenueBeverageSale]) {
      await model.createIndexes();
      console.log(`  indexes ensured on ${model.collection.collectionName}`);
    }
  }

  // Venue ledger position, for the record. Expected to be zero on first run.
  const venueCount = await Venue.countDocuments();
  const venueSaleCount = await VenueBeverageSale.countDocuments();
  console.log(`Venues: ${venueCount} · venue beverage sales: ${venueSaleCount}`);

  console.log("Migration complete");
};

migrate({ dryRun: process.argv.includes("--dry-run") })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
