const mongoose = require("mongoose");

// A dry run must be genuinely read-only — same reasoning as backfillLedger.js:
// Mongoose builds indexes on first model use, and that is a write.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Payment = require("../models/Payment");
const PlatformFeeLedger = require("../models/PlatformFeeLedger");
const {
  settledInRange,
  ticketSaleMatch,
  eatDateKey,
  eatDayBounds,
  shiftDateKey,
  getOrCreateConfig,
  computeDailyTotal,
} = require("../services/platformFeeService");

// Recompute the daily platform-fee ledger over a range of past days.
//
// WHY: computeDailyTotal used to filter `provider: "chapa_giftcard"`, of which
// production has none. Every day it ran it computed 0, so all 74 ledger rows
// are zero and nothing was ever swept. The filter is fixed; this reruns the
// days that were computed under the broken one.
//
// DRY RUN BY DEFAULT. Nothing is written unless --write is passed.
//
//   node src/scripts/backfillPlatformFees.js                      # report
//   node src/scripts/backfillPlatformFees.js --days=120           # wider range
//   node src/scripts/backfillPlatformFees.js --from=2026-05-01
//   node src/scripts/backfillPlatformFees.js --write              # apply
//   node src/scripts/backfillPlatformFees.js --usd
//
// READ THE BREAKDOWN BEFORE PASSING --write. The `Payment` collection is shared
// by ticket sales, invitation fees, campaign payments and on-door cash, and
// only ticket sales belong in this figure. The first thing this prints is how
// every PAID payment in the range classifies, so the discriminator can be
// checked against real data rather than trusted. If the "excluded" rows do not
// look like invitations and campaigns, stop and fix the filter first.
//
// SENT rows are never touched. Those are the frozen record of money that
// actually moved; recomputing one would rewrite history to match a number that
// was never paid. They are listed at the end as "frozen" so the days the fix
// cannot reach are explicit rather than silently skipped.
//
// This only recomputes what is OWED. It sends nothing — sweeping is sendFee(),
// deliberately a separate, human-initiated step.

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CURRENCY = args.includes("--usd") ? "USD" : "ETB";

const argValue = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// How each PAID payment in the range classifies, so the ticket-sale filter can
// be checked against real data before anything is written.
const classify = async (start, end) => {
  const rows = await Payment.aggregate([
    // Same window definition the figures below use — see settledInRange. A
    // table that counted a different set from the totals under it would be
    // worse than no table.
    { $match: { status: "PAID", currency: CURRENCY, ...settledInRange(start, end) } },
    {
      $group: {
        _id: {
          purpose: {
            $switch: {
              branches: [
                { case: { $eq: ["$invitationType", "campaign"] }, then: "campaign payment" },
                { case: { $eq: ["$invitationType", "on-door"] }, then: "on-door cash" },
                { case: { $eq: ["$invitationType", "bulk_invitation_fee"] }, then: "bulk invitation fee" },
                { case: { $ne: [{ $type: "$ticketDetails.campaignId" }, "missing"] }, then: "campaign payment" },
                { case: { $ne: [{ $type: "$ticketDetails.qrCodeCount" }, "missing"] }, then: "invitation fee" },
                { case: { $ne: [{ $type: "$ticketDetails.ticketCount" }, "missing"] }, then: "TICKET SALE" },
              ],
              default: "unclassified",
            },
          },
          provider: { $ifNull: ["$provider", "(none recorded)"] },
        },
        total: { $sum: "$price" },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);
  return rows;
};

const main = async () => {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set — nothing to connect to.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(WRITE ? "MODE: WRITE — ledger rows will be updated" : "MODE: dry run — nothing will be written");

  const todayKey = eatDateKey();
  // Today is excluded: it has not fully elapsed, and sendFee() refuses it
  // anyway. The last complete day is yesterday.
  const lastKey = shiftDateKey(todayKey, -1);
  const days = Number(argValue("days", 90));
  const firstKey = argValue("from", shiftDateKey(lastKey, -(days - 1)));

  console.log(`Currency: ${CURRENCY}`);
  console.log(`Range:    ${firstKey} .. ${lastKey} (EAT calendar days)\n`);

  const config = await getOrCreateConfig();
  console.log(`Fee rate: ${config.feePercentage}%\n`);

  // ---- 1. classification, so the filter can be checked against real data ----
  const { start: rangeStart } = eatDayBounds(firstKey);
  const { end: rangeEnd } = eatDayBounds(lastKey);
  const buckets = await classify(rangeStart, rangeEnd);

  console.log("Every PAID payment in the range, by what it is:\n");
  console.log("  purpose                provider           count           amount   counted?");
  console.log("  " + "-".repeat(76));
  let classifiedTicketTotal = 0;
  for (const row of buckets) {
    const isTicket = row._id.purpose === "TICKET SALE";
    if (isTicket) classifiedTicketTotal += row.total;
    console.log(
      `  ${row._id.purpose.padEnd(22)} ${String(row._id.provider).padEnd(18)} ` +
        `${String(row.count).padStart(5)} ${money(row.total).padStart(16)}   ${isTicket ? "yes" : "no"}`
    );
  }
  if (!buckets.length) console.log("  (no PAID payments in this range)");
  console.log();

  const unclassified = buckets.filter((r) => r._id.purpose === "unclassified");
  if (unclassified.length) {
    const total = unclassified.reduce((sum, r) => sum + r.total, 0);
    console.log(
      `  WARNING: ${unclassified.reduce((s, r) => s + r.count, 0)} payments ` +
        `totalling ${money(total)} ${CURRENCY} match no known purpose and are NOT counted.\n` +
        `  Check what they are before trusting the totals below.\n`
    );
  }

  // ---- 2. per-day recompute ----
  const changes = [];
  const frozen = [];
  let dateKey = firstKey;
  while (dateKey <= lastKey) {
    const existing = await PlatformFeeLedger.findOne({ date: dateKey, currency: CURRENCY });

    if (existing && existing.status === "SENT") {
      frozen.push({ dateKey, existing });
      dateKey = shiftDateKey(dateKey, 1);
      continue;
    }

    const { totalSales, paymentCount, giftCardSales } = await computeDailyTotal(dateKey, CURRENCY);
    const feeAmount = round2(totalSales * (config.feePercentage / 100));

    const wasFee = existing ? existing.feeAmount : 0;
    if (totalSales > 0 || existing) {
      changes.push({
        dateKey,
        existed: !!existing,
        wasSales: existing ? existing.totalSales : 0,
        wasFee,
        totalSales,
        paymentCount,
        giftCardSales,
        feeAmount,
      });
    }

    dateKey = shiftDateKey(dateKey, 1);
  }

  const withMovement = changes.filter((c) => round2(c.feeAmount) !== round2(c.wasFee));

  console.log(`Days recomputed: ${changes.length}   changed: ${withMovement.length}   frozen (already SENT): ${frozen.length}\n`);

  if (withMovement.length) {
    console.log("  date         sales        was fee        now fee    of which via card");
    console.log("  " + "-".repeat(76));
    for (const c of withMovement) {
      console.log(
        `  ${c.dateKey}  ${money(c.totalSales).padStart(12)} ` +
          `${money(c.wasFee).padStart(14)} ${money(c.feeAmount).padStart(14)}    ${money(c.giftCardSales).padStart(12)}`
      );
    }
    console.log();
  }

  const totalWas = round2(changes.reduce((s, c) => s + c.wasFee, 0));
  const totalNow = round2(changes.reduce((s, c) => s + c.feeAmount, 0));
  const totalSales = round2(changes.reduce((s, c) => s + c.totalSales, 0));
  const totalSourceable = round2(changes.reduce((s, c) => s + c.giftCardSales, 0));

  console.log(`  ticket sales in range     ${money(totalSales).padStart(16)} ${CURRENCY}`);
  console.log(`  fee previously recorded   ${money(totalWas).padStart(16)} ${CURRENCY}`);
  console.log(`  fee actually owed         ${money(totalNow).padStart(16)} ${CURRENCY}`);
  console.log(`  under-recorded by         ${money(totalNow - totalWas).padStart(16)} ${CURRENCY}\n`);

  // The payout draws from a gift card. If nothing landed in one, the fee is
  // correctly recorded as owed and still cannot be swept by this mechanism —
  // which is a configuration problem, not an arithmetic one, and better said
  // out loud than discovered as a failed payout at 00:05.
  if (totalSourceable < totalNow) {
    console.log(
      `  NOTE: only ${money(totalSourceable)} ${CURRENCY} of these sales landed in a gift card.\n` +
        `  sendFee() pays out of a gift card, so it cannot source the rest. Recording\n` +
        `  what is owed is still correct — but sweeping it needs gift-card routing\n` +
        `  configured, or a different settlement path.\n`
    );
  }

  if (frozen.length) {
    console.log(`  ${frozen.length} day(s) are already SENT and were left untouched:`);
    for (const f of frozen) {
      console.log(`    ${f.dateKey}  sent ${money(f.existing.feeAmount)} ${CURRENCY} on ${f.existing.sentAt?.toISOString().slice(0, 10) || "?"}`);
    }
    console.log();
  }

  if (!WRITE) {
    console.log("Dry run — nothing written. Re-run with --write to apply.\n");
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const c of changes) {
    await PlatformFeeLedger.findOneAndUpdate(
      { date: c.dateKey, currency: CURRENCY },
      {
        $set: {
          totalSales: c.totalSales,
          paymentCount: c.paymentCount,
          giftCardSales: c.giftCardSales,
          feePercentage: config.feePercentage,
          feeAmount: c.feeAmount,
        },
        // Only ever set on insert: a day that previously FAILED to send keeps
        // that status, because the recompute changes what is owed and says
        // nothing about whether the payout succeeded.
        $setOnInsert: { status: "PENDING" },
      },
      { upsert: true }
    );
    written += 1;
  }

  console.log(`Wrote ${written} ledger row(s). Nothing was sent — sweeping is a separate, deliberate step.\n`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("\nbackfillPlatformFees failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
