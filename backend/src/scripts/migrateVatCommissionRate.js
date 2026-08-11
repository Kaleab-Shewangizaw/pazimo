const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const PlatformFeeConfig = require("../models/PlatformFeeConfig");
const PlatformFeeLedger = require("../models/PlatformFeeLedger");
const { TOTAL_CUT_PERCENT, COMMISSION_PERCENT } = require("../config/rates");
const { splitFee } = require("../services/platformFeeService");

// One-off migration for the VAT change.
//
// 1. The daily fee sweep percentage lives in a saved PlatformFeeConfig
//    document, so raising the schema default from 3 to 3.45 does nothing for
//    an existing install — the stored 3 keeps winning. This bumps it, but only
//    if it is still exactly the old 3%: an admin who deliberately set some
//    other rate should not have it overwritten.
//
// 2. Backfills commissionAmount/vatAmount on ledger rows written before those
//    fields existed. PENDING rows recompute themselves on next read anyway;
//    SENT rows never do, and those are the ones that matter for filing.
//
// Safe to re-run.
const OLD_FEE_PERCENTAGE = COMMISSION_PERCENT; // 3
const NEW_FEE_PERCENTAGE = TOTAL_CUT_PERCENT; // 3.45

// Stored percentages are compared with a tolerance, not ===. An earlier run of
// this script could have written 3.4499999999999997 (floating-point 3 * 1.15),
// and that value must still be recognised as "already migrated" so it gets
// cleaned up to exactly 3.45 instead of tripping the "don't touch a custom
// rate" guard below.
const closeTo = (a, b) => Math.abs(a - b) < 0.005;

const migrate = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not defined — set it in .env or the env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log("Connected to MongoDB");

  const config = await PlatformFeeConfig.findOne();
  if (!config) {
    console.log("No PlatformFeeConfig yet — the new 3.45% default will apply.");
  } else if (closeTo(config.feePercentage, NEW_FEE_PERCENTAGE)) {
    if (config.feePercentage !== NEW_FEE_PERCENTAGE) {
      const previous = config.feePercentage;
      config.feePercentage = NEW_FEE_PERCENTAGE;
      await config.save();
      console.log(`Cleaned up rounding: ${previous}% → ${NEW_FEE_PERCENTAGE}%.`);
    } else {
      console.log(`Fee percentage already ${NEW_FEE_PERCENTAGE}% — nothing to do.`);
    }
  } else if (closeTo(config.feePercentage, OLD_FEE_PERCENTAGE)) {
    config.feePercentage = NEW_FEE_PERCENTAGE;
    await config.save();
    console.log(
      `Fee percentage raised ${OLD_FEE_PERCENTAGE}% → ${NEW_FEE_PERCENTAGE}% (3% commission + 15% VAT on it).`
    );
  } else {
    console.warn(
      `Fee percentage is ${config.feePercentage}%, which is neither the old ${OLD_FEE_PERCENTAGE}% nor the new ${NEW_FEE_PERCENTAGE}%. Leaving it alone — set it by hand if that is not intentional.`
    );
  }

  const ledgers = await PlatformFeeLedger.find({
    $or: [{ vatAmount: { $exists: false } }, { vatAmount: null }],
  });

  let updated = 0;
  for (const ledger of ledgers) {
    const { commissionAmount, vatAmount } = splitFee(ledger.feeAmount);
    ledger.commissionAmount = commissionAmount;
    ledger.vatAmount = vatAmount;
    await ledger.save();
    updated += 1;
  }
  console.log(`Backfilled commission/VAT split on ${updated} ledger row(s).`);

  await mongoose.disconnect();
  console.log("Done.");
};

// Only run when invoked directly (`node src/scripts/migrateVatCommissionRate.js`).
// Without this guard merely requiring the file connects to whatever database
// MONGODB_URI points at and starts writing — which is exactly what a stray
// `require()` during development did once already.
if (require.main === module) {
  migrate().catch(async (error) => {
    console.error("Migration failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = migrate;
