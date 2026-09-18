const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { generateReferenceNumber } = require("../utils/referenceCode");
const BeverageSale = require("../models/BeverageSale");
const VenueBeverageSale = require("../models/VenueBeverageSale");

// One-time remediation for the switch away from sequential reference numbers
// (see utils/referenceCode.js and the models' own comments).
//
// A sequential "PZB-SL-000014" is guessable from any other real one — knowing
// one valid code tells you 13, 15, ... are worth trying too — and until this
// runs, every sale written before the switch still carries one. The new
// random generator only ever applies going forward (the model's pre-validate
// hook only fires on an unset field), so those old codes are not
// self-healing; they need to be reassigned explicitly.
//
// Scoped to BeverageSaleSchema.statics.OUTSTANDING /
// VenueBeverageSaleSchema.statics.OUTSTANDING deliberately: a sale that is
// already collected or refunded cannot be "stolen" by someone guessing its
// code, so reassigning those would just churn a "never reassigned" field on
// the record for a risk that no longer exists. Only a still-outstanding
// (online, confirmed, not yet redeemed) sale is worth touching.
const regenerate = async (Model, prefix, label, { dryRun }) => {
  const outstanding = await Model.find(Model.OUTSTANDING).select("referenceNumber");
  console.log(`${label}: ${outstanding.length} outstanding sale(s)`);

  let changed = 0;
  for (const sale of outstanding) {
    const before = sale.referenceNumber;
    if (dryRun) {
      console.log(`  [dry run] would replace ${before}`);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop -- each draw's uniqueness check depends on the ones already committed.
    sale.referenceNumber = await generateReferenceNumber(prefix, (candidate) =>
      Model.exists({ referenceNumber: candidate })
    );
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose, see above.
    await sale.save();
    console.log(`  ${before} -> ${sale.referenceNumber}`);
    changed += 1;
  }

  console.log(`${label}: ${changed} reference number(s) reassigned`);
};

const migrate = async ({ dryRun }) => {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI is not defined in .env, please pass it as env var");
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(`Connected to MongoDB${dryRun ? " (dry run — no writes)" : ""}`);

  await regenerate(BeverageSale, "EV", "Event beverage sales", { dryRun });
  await regenerate(VenueBeverageSale, "VB", "Venue beverage sales", { dryRun });

  console.log("Migration complete");
};

migrate({ dryRun: process.argv.includes("--dry-run") })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
