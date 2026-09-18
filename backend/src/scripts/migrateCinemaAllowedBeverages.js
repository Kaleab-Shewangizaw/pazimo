const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);
const Cinema = require("../models/Cinema");
const Beverage = require("../models/Beverage");
const CinemaBeverage = require("../models/CinemaBeverage");

/**
 * Move cinema concessions from a deny list to an allow list, changing nothing.
 *
 * The two lists read in opposite directions: an empty `blockedBeverages` meant
 * "sell everything", an empty `allowedBeverages` means "sell nothing". Shipping
 * the new rule without this would close every counter on the platform at once.
 *
 * So each cinema is seeded with exactly what it could sell yesterday — the
 * active catalogue minus whatever was blocked for it. The admin narrows from
 * there; nobody loses a product they were already selling.
 *
 * Also folds CINEMA-OWNED products into the platform catalogue. Cinemas no
 * longer create products, so a row owned by one would be unreachable: not in
 * the admin's list to grant, and not creatable again. Setting ownerCinema to
 * null makes it an ordinary catalogue product the admin can manage, and grants
 * it to the cinema that added it so their counter is unaffected.
 *
 * DRY RUN BY DEFAULT.
 *
 *   npm run migrate:cinema-allowed
 *   npm run migrate:cinema-allowed -- --write
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

  // --- 1. cinema-owned products become platform products ------------------
  const owned = await Beverage.find({ ownerCinema: { $ne: null } })
    .select("name ownerCinema")
    .lean();

  console.log(`\n  cinema-owned products to fold into the catalogue: ${owned.length}`);
  owned.forEach((b) =>
    console.log(`    ${b.name}  (added by cinema ${String(b.ownerCinema).slice(-6)})`)
  );

  // --- 2. seed each cinema's allow list -----------------------------------
  const cinemas = await Cinema.find({})
    .select("name blockedBeverages allowedBeverages")
    .lean();
  const activeIds = (await Beverage.find({ isActive: true }).select("_id").lean()).map(
    (b) => String(b._id)
  );

  console.log(`\n  active catalogue products: ${activeIds.length}`);
  console.log(`  cinemas: ${cinemas.length}\n`);

  const plans = [];
  for (const cinema of cinemas) {
    // Already migrated — a re-run must not overwrite an admin's later choices.
    if ((cinema.allowedBeverages || []).length > 0) {
      console.log(`  ${cinema.name.padEnd(20)} already granted ${cinema.allowedBeverages.length} — left alone`);
      continue;
    }

    const blocked = new Set((cinema.blockedBeverages || []).map(String));
    const grant = new Set(activeIds.filter((id) => !blocked.has(id)));

    // Anything this cinema is ALREADY selling is granted even if it is inactive
    // or was blocked: the line-up row is the stronger statement of intent, and
    // silently removing a product from a live counter is the one outcome this
    // migration exists to avoid.
    const lineup = await CinemaBeverage.find({ cinema: cinema._id })
      .select("beverage")
      .lean();
    let rescued = 0;
    for (const row of lineup) {
      const id = String(row.beverage);
      if (!grant.has(id)) {
        grant.add(id);
        rescued += 1;
      }
    }

    plans.push({ cinema, grant: [...grant] });
    console.log(
      `  ${cinema.name.padEnd(20)} grant ${String(grant.size).padStart(3)}` +
        `  (blocked ${blocked.size}${rescued ? `, rescued ${rescued} already on sale` : ""})`
    );
  }

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.\n");
    await mongoose.disconnect();
    return;
  }

  if (owned.length) {
    const result = await Beverage.updateMany(
      { ownerCinema: { $ne: null } },
      { $set: { ownerCinema: null } }
    );
    console.log(`\n  folded ${result.modifiedCount} product(s) into the platform catalogue`);
  }

  for (const { cinema, grant } of plans) {
    await Cinema.updateOne(
      { _id: cinema._id },
      { $set: { allowedBeverages: grant, allowedBeveragesSetAt: new Date() } }
    );
  }
  console.log(`  seeded the allow list on ${plans.length} cinema(s)`);

  console.log(
    "\nEvery cinema can sell exactly what it could before. The admin narrows from here.\n"
  );
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nmigrateCinemaAllowedBeverages failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
