const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

mongoose.set("autoIndex", false);
const User = require("../models/User");
const { normalizePhone } = require("../utils/phone");

/**
 * Backfill User.normalizedPhone for every account that predates the field.
 *
 * Exact-match phone search (ticketShareService.searchRecipients) compares
 * against normalizedPhone, which the User pre-save hook only sets when
 * phoneNumber is *modified* — it never touches existing rows. Without this,
 * every account created before the field existed is simply unfindable by
 * phone until its owner happens to save a profile edit.
 *
 * A phoneNumber that doesn't normalize (fails the /^\d{8,15}$/ shape check
 * after stripping formatting) is left alone rather than guessed at, and is
 * reported so it can be looked at by hand.
 *
 * DRY RUN BY DEFAULT.
 *
 *   node src/scripts/backfillUserNormalizedPhone.js
 *   node src/scripts/backfillUserNormalizedPhone.js -- --write
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

  const cursor = User.find(
    { normalizedPhone: { $exists: false } },
    { phoneNumber: 1 }
  ).cursor();

  let scanned = 0;
  let normalized = 0;
  let unparseable = 0;
  const badExamples = [];

  for await (const user of cursor) {
    scanned += 1;
    const value = normalizePhone(user.phoneNumber);
    if (!value) {
      unparseable += 1;
      if (badExamples.length < 10) {
        badExamples.push({ id: user._id.toString(), phoneNumber: user.phoneNumber });
      }
      continue;
    }
    normalized += 1;
    if (WRITE) {
      await User.updateOne({ _id: user._id }, { $set: { normalizedPhone: value } });
    }
  }

  console.log(`\n  users missing normalizedPhone : ${scanned}`);
  console.log(`  successfully normalized       : ${normalized}`);
  console.log(`  left unparseable               : ${unparseable}`);
  if (badExamples.length) {
    console.log("\n  sample unparseable rows (check by hand):");
    badExamples.forEach((b) => console.log(`    ${b.id}  "${b.phoneNumber}"`));
  }

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.\n");
  } else {
    console.log(`\nWrote normalizedPhone on ${normalized} account(s).\n`);
  }

  await mongoose.disconnect();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
