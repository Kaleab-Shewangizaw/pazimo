const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);
const Beverage = require("../models/Beverage");

/**
 * Let a cinema own its own products.
 *
 * Beverage.name used to be globally unique. That was right while the catalogue
 * was admin-only, and wrong the moment cinemas could add their own: two cinemas
 * each listing "Popcorn" are listing different products at different prices that
 * happen to share a word, and a global index makes the second one fail.
 *
 * Uniqueness is now per owner. Two things have to happen for that to hold, and
 * NEITHER happens on its own:
 *
 *   1. Existing rows get `ownerCinema: null` — the platform catalogue. Mongoose
 *      defaults do not touch rows that already exist, so without this they have
 *      no value at all and fall outside the new index.
 *   2. The OLD global index is dropped. Mongoose creates missing indexes; it
 *      never removes one it no longer declares. Left in place it would keep
 *      rejecting a cinema's "Coke" for clashing with the platform's.
 *
 * DRY RUN BY DEFAULT.
 *
 *   npm run migrate:beverage-ownership
 *   npm run migrate:beverage-ownership -- --write
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

  const collection = Beverage.collection;
  const indexes = await collection.indexes();

  // The old one: unique, on name alone. Matched by shape rather than by name so
  // it is found whatever Mongo happened to call it.
  const oldIndex = indexes.find(
    (i) =>
      i.unique &&
      Object.keys(i.key).length === 1 &&
      i.key.name === 1
  );
  const newIndex = indexes.find(
    (i) => i.unique && i.key.ownerCinema === 1 && i.key.name === 1
  );

  const total = await Beverage.countDocuments({});
  const unowned = await Beverage.countDocuments({
    $or: [{ ownerCinema: { $exists: false } }, { ownerCinema: null }],
  });
  const cinemaOwned = total - unowned;

  console.log(`\n  products in total            : ${total}`);
  console.log(`  platform-wide (or unset)     : ${unowned}`);
  console.log(`  already owned by a cinema    : ${cinemaOwned}`);
  console.log(`\n  old global unique index      : ${oldIndex ? oldIndex.name : "(already gone)"}`);
  console.log(`  new per-owner unique index   : ${newIndex ? newIndex.name : "(not created yet)"}`);

  const needsField = await Beverage.countDocuments({ ownerCinema: { $exists: false } });
  console.log(`\n  rows needing ownerCinema set : ${needsField}`);

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.\n");
    await mongoose.disconnect();
    return;
  }

  // Field first, index second. Creating the per-owner unique index while rows
  // still lack the field would compare missing against missing and could reject
  // two legitimately distinct platform products.
  if (needsField > 0) {
    const result = await Beverage.updateMany(
      { ownerCinema: { $exists: false } },
      { $set: { ownerCinema: null } }
    );
    console.log(`  set ownerCinema: null on ${result.modifiedCount} product(s)`);
  }

  if (oldIndex) {
    await collection.dropIndex(oldIndex.name);
    console.log(`  dropped the old global unique index (${oldIndex.name})`);
  }

  if (!newIndex) {
    await collection.createIndex(
      { ownerCinema: 1, name: 1 },
      { unique: true, collation: { locale: "en", strength: 2 } }
    );
    console.log("  created the per-owner unique index");
  }

  console.log("\nCinemas can now add their own products without clashing.\n");
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nmigrateBeverageOwnership failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
