const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);
const ConcessionProduct = require("../models/ConcessionProduct");
const Beverage = require("../models/Beverage");

/**
 * Splits cinema concessions out of the Beverage catalogue into their own
 * collection, ConcessionProduct — changing nothing about what any cinema can
 * currently sell, or what any organizer/venue can currently sell.
 *
 * Beverage used to carry both the event/venue drinks catalogue AND cinema
 * concessions, told apart only by a `category` field and a since-abandoned
 * `ownerCinema` escape hatch. The two catalogues share no admin screen, no
 * pricing model and no uniqueness rule, so they should never have shared a
 * table — and in practice a handful of rows ended up double-booked: the same
 * "BEDELE" or "Habesha Beer" row sold at an event AND put on a cinema's
 * counter, because both channels could reach the one shared catalogue.
 *
 * A row used ONLY by the cinema channel is moved with its _id preserved, so
 * every CinemaBeverage/CinemaBeverageSale row and cinema grant that already
 * points at it keeps working with no further change. A row ALSO used by an
 * EventBeverage or VenueBeverage is left in Beverage untouched — organizers
 * still need it — and instead COPIED into ConcessionProduct under a NEW id;
 * every cinema-side reference to the old id (CinemaBeverage.beverage,
 * CinemaBeverageSale.beverage, a cinema's allow list) is then repointed at
 * the copy. After this, the two catalogues own separate rows even where they
 * once pointed at the same one.
 *
 * Every cinema's legacy `allowedBeverages`/`blockedBeverages` arrays (read via
 * the raw collection — the Cinema schema no longer declares them) are copied
 * onto the new `allowedConcessions` field, remapped where a copy happened,
 * then the legacy fields are unset.
 *
 * DRY RUN BY DEFAULT.
 *
 *   npm run migrate:cinema-catalog
 *   npm run migrate:cinema-catalog -- --write
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

  const db = mongoose.connection.db;
  const beverages = db.collection("beverages");
  const concessionProducts = db.collection("concessionproducts");
  const cinemaBeverages = db.collection("cinemabeverages");
  const cinemaBeverageSales = db.collection("cinemabeveragesales");
  const cinemas = db.collection("cinemas");
  const eventBeverages = db.collection("eventbeverages");
  const venueBeverages = db.collection("venuebeverages");

  // --- 1. find every product the cinema channel actually uses --------------
  const byCategory = await beverages
    .find({ category: { $in: ["snack", "combo"] } }, { projection: { _id: 1 } })
    .toArray();
  const byLineup = await cinemaBeverages.distinct("beverage");
  const cinemaDocs = await cinemas
    .find({}, { projection: { name: 1, allowedBeverages: 1, blockedBeverages: 1 } })
    .toArray();
  const byGrant = cinemaDocs.flatMap((c) => [
    ...(c.allowedBeverages || []),
    ...(c.blockedBeverages || []),
  ]);

  const targetIds = [
    ...new Map(
      [...byCategory.map((b) => b._id), ...byLineup, ...byGrant].map((id) => [
        String(id),
        id,
      ])
    ).values(),
  ];

  console.log(`\n  products the cinema channel uses: ${targetIds.length}`);
  console.log(`    by category (snack/combo): ${byCategory.length}`);
  console.log(`    on a cinema's line-up:      ${byLineup.length}`);
  console.log(`    in a cinema's grant/block list: ${new Set(byGrant.map(String)).size}`);

  const sourceRows = await beverages.find({ _id: { $in: targetIds } }).toArray();
  const alreadyMoved = targetIds.length - sourceRows.length;
  if (alreadyMoved > 0) {
    console.log(`  (${alreadyMoved} already moved on a previous run — will be skipped)`);
  }

  // --- 2. split into cinema-only (move) vs also-shared (copy) --------------
  const cinemaOnly = [];
  const shared = [];
  for (const row of sourceRows) {
    const [inEvent, inVenue] = await Promise.all([
      eventBeverages.countDocuments({ beverage: row._id }, { limit: 1 }),
      venueBeverages.countDocuments({ beverage: row._id }, { limit: 1 }),
    ]);
    if (inEvent || inVenue) shared.push(row);
    else cinemaOnly.push(row);
  }

  console.log(`\n  cinema-only — moved, same id: ${cinemaOnly.length}`);
  cinemaOnly.forEach((r) => console.log(`    ${r.name.padEnd(24)} category=${r.category || "drink"}`));

  console.log(`\n  ALSO sold at an event or venue — copied under a new id: ${shared.length}`);
  shared.forEach((r) =>
    console.log(
      `    ${r.name.padEnd(24)} category=${r.category || "drink"}  (Beverage row ${r._id} stays put for that event/venue)`
    )
  );

  // --- 3. seed each cinema's new allow list, ready for remapping -----------
  const cinemasToMigrate = cinemaDocs.filter(
    (c) => c.allowedBeverages !== undefined || c.blockedBeverages !== undefined
  );
  console.log(`\n  cinemas carrying the legacy fields: ${cinemasToMigrate.length}`);
  cinemasToMigrate.forEach((c) =>
    console.log(
      `    ${(c.name || String(c._id)).padEnd(24)} allowed=${(c.allowedBeverages || []).length}`
    )
  );

  if (!WRITE) {
    console.log("\nDry run complete. Re-run with --write to apply.");
    await mongoose.disconnect();
    process.exit(0);
  }

  // --- 4. write: cinema-only rows move with their _id preserved ------------
  for (const row of cinemaOnly) {
    await concessionProducts.updateOne(
      { _id: row._id },
      {
        $setOnInsert: {
          _id: row._id,
          name: row.name,
          image: row.image ?? null,
          color: row.color ?? null,
          category: row.category || "snack",
          isActive: row.isActive ?? true,
          createdBy: row.createdBy,
          updatedBy: row.updatedBy,
          createdAt: row.createdAt || new Date(),
          updatedAt: row.updatedAt || new Date(),
        },
      },
      { upsert: true }
    );
  }
  if (cinemaOnly.length) {
    const removed = await beverages.deleteMany({
      _id: { $in: cinemaOnly.map((r) => r._id) },
    });
    console.log(`\n  moved ${cinemaOnly.length} product(s); removed ${removed.deletedCount} from beverages`);
  }

  // --- 5. write: shared rows are copied under a new id, then remapped ------
  const remap = new Map(); // oldId (string) -> newId (ObjectId)
  for (const row of shared) {
    const newId = new mongoose.Types.ObjectId();
    remap.set(String(row._id), newId);
    await concessionProducts.updateOne(
      { _id: newId },
      {
        $setOnInsert: {
          _id: newId,
          name: row.name,
          image: row.image ?? null,
          color: row.color ?? null,
          category: row.category || "snack",
          isActive: row.isActive ?? true,
          createdBy: row.createdBy,
          updatedBy: row.updatedBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    await cinemaBeverages.updateMany({ beverage: row._id }, { $set: { beverage: newId } });
    await cinemaBeverageSales.updateMany({ beverage: row._id }, { $set: { beverage: newId } });
  }
  if (shared.length) {
    console.log(`  copied ${shared.length} shared product(s) under a new id and repointed the cinema side`);
  }

  // --- 6. write: rename the allow/deny lists on each cinema, remapped ------
  let cinemasUpdated = 0;
  for (const c of cinemasToMigrate) {
    const nextAllowed = (c.allowedBeverages || []).map(
      (id) => remap.get(String(id)) || id
    );
    await cinemas.updateOne(
      { _id: c._id },
      {
        $set: { allowedConcessions: nextAllowed },
        $unset: {
          allowedBeverages: "",
          allowedBeveragesSetBy: "",
          allowedBeveragesSetAt: "",
          blockedBeverages: "",
          blockedBeveragesSetBy: "",
          blockedBeveragesSetAt: "",
        },
      }
    );
    cinemasUpdated += 1;
  }
  console.log(`  updated ${cinemasUpdated} cinema(s) to allowedConcessions`);

  // --- 7. bring indexes in line with the new schemas ------------------------
  await ConcessionProduct.syncIndexes();
  await Beverage.syncIndexes();
  console.log("  indexes synced on concessionproducts and beverages");

  console.log("\nDone.");
  await mongoose.disconnect();
  process.exit(0);
};

main().catch(async (error) => {
  console.error("\nmigrateCinemaConcessionCatalog crashed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
