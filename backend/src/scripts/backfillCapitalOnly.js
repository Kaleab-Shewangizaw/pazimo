// Targeted stand-in for backfillLedger.js's "Pazimo Capital" section only.
//
// backfillLedger.js processes tickets/beverages/cinema first and Capital
// last, and on production it's stuck for a very long time in the ticket
// section (thousands of already-recorded rows to skip-check one at a time).
// migrateCapitalPoolSeparation.js already wrote the correct DEBIT side for
// the real double-withdrawal reconciliation; without the CREDIT side (loan
// principal) the ledger's capital partition reads as a large negative.
// This writes only that missing credit side — a handful of borrowers,
// seconds not hours — so the admin dashboard's capital card is correct
// without waiting for the full backfill to ever reach that section.
//
// Same writeLoanDelta logic as backfillLedger.js, byte-for-byte, just
// extracted to run on its own. Dry run by default.
//
//   node backfillCapitalOnly.js            # report only
//   node backfillCapitalOnly.js --write    # apply

const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { toMinor, formatMinor } = require("../utils/money");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CURRENCY = args.includes("--usd") ? "USD" : "ETB";

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Currency: ${CURRENCY}   Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}\n`);

  const ledger = require("../services/ledgerService");
  const Loan = require("../models/Loan");
  const LedgerEntry = require("../models/LedgerEntry");
  const { getOrganizerLoanFinance } = require("../services/loanRepaymentService");

  const currencyMatch =
    CURRENCY === "USD"
      ? { currency: "USD" }
      : { $or: [{ currency: "ETB" }, { currency: { $exists: false } }, { currency: null }] };

  const recordedTotal = async (owner, kind) => {
    const [existing] = await LedgerEntry.aggregate([
      {
        $match: {
          "owner.kind": owner.kind,
          "owner.id": owner.id,
          stream: "capital",
          currency: CURRENCY,
          kind,
        },
      },
      { $group: { _id: null, total: { $sum: "$amountMinor" } } },
    ]);
    return Math.abs(existing?.total || 0);
  };

  const writeLoanDelta = async ({ owner, kind, currentTotalMinor, note }) => {
    const recordedMinor = await recordedTotal(owner, kind);
    const delta = currentTotalMinor - recordedMinor;
    if (delta <= 0) return { delta: 0, verified: true };

    if (!WRITE) return { delta, verified: null };

    // MUST include the stream. backfillLedger.js's original key
    // (`${kind}:${owner.id}:${CURRENCY}:upto:${total}`) has no stream in it —
    // found 2026-09-25 that 3 of these 4 organizers have a STALE
    // loan_principal entry sitting on stream:"tickets" from before the
    // capital-pool-separation fix (2026-09-18, the historical mis-streaming
    // bug). append()'s idempotency check matches by key alone, so it found
    // that old wrong-stream entry, treated the write as "already done," and
    // silently no-opped — the exact silent failure this script's readback
    // caught last run. Scoping the key by stream is what lets a correctly
    // streamed entry be written without colliding with that old one.
    const idempotencyKey = `${kind}:capital:${owner.id}:${CURRENCY}:upto:${currentTotalMinor}`;
    // Write, then read the entry straight back — the earlier run reported
    // success for every organizer while 3 of 4 silently never persisted, so
    // this call is no longer trusted on its return value alone.
    await ledger.append({
      owner, currency: CURRENCY, stream: "capital",
      kind, amountMinor: delta,
      source: { note },
      idempotencyKey,
    });
    const found = await LedgerEntry.findOne({ idempotencyKey, stream: "capital" }).lean();
    const afterTotal = await recordedTotal(owner, kind);
    const verified = !!found && afterTotal >= currentTotalMinor;
    return { delta, verified, foundEntry: !!found, afterTotal };
  };

  const borrowers = await Loan.distinct("organizer", {
    ...currencyMatch,
    status: { $in: ["active", "repaid"] },
  });
  console.log(`Borrowers found: ${borrowers.length}\n`);

  let totalDeltaMinor = 0;
  let failures = 0;
  for (const organizerId of borrowers) {
    const finance = await getOrganizerLoanFinance(organizerId, CURRENCY);
    const owner = { kind: "organizer", id: organizerId };
    const principal = toMinor(finance.principalCredited || 0);
    if (principal <= 0) continue;

    let result;
    try {
      result = await writeLoanDelta({
        owner, kind: "loan_principal", currentTotalMinor: principal,
        note: "backfill: capital principal (targeted, capital-only run)",
      });
    } catch (error) {
      failures += 1;
      console.log(`  organizer ${organizerId}  ERROR: ${error.message}`);
      continue;
    }

    const { delta, verified } = result;
    totalDeltaMinor += delta;
    if (delta <= 0) {
      console.log(`  organizer ${organizerId}  principal ${finance.principalCredited.toFixed(2)} ${CURRENCY}  -> already recorded, no delta`);
    } else if (!WRITE) {
      console.log(`  organizer ${organizerId}  principal ${finance.principalCredited.toFixed(2)} ${CURRENCY}  -> writing delta ${formatMinor(delta, CURRENCY)}`);
    } else if (verified) {
      console.log(`  organizer ${organizerId}  principal ${finance.principalCredited.toFixed(2)} ${CURRENCY}  -> wrote delta ${formatMinor(delta, CURRENCY)}  [VERIFIED]`);
    } else {
      failures += 1;
      console.log(`  organizer ${organizerId}  principal ${finance.principalCredited.toFixed(2)} ${CURRENCY}  -> claimed delta ${formatMinor(delta, CURRENCY)} but readback FAILED to confirm it — ${JSON.stringify(result)}`);
    }
  }

  console.log(`\nTotal new credit ${WRITE ? "written" : "to write"}: ${formatMinor(totalDeltaMinor, CURRENCY)}`);
  if (failures > 0) console.log(`\n${failures} organizer(s) FAILED verification — do not trust this run as complete.`);
  console.log(WRITE ? (failures > 0 ? "\nDone, with failures above." : "\nDone, all writes verified.") : "\nDry run — nothing written. Re-run with --write to apply.");
  console.log("");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
