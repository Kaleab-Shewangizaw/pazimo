const mongoose = require("mongoose");

// Read-only unless --write is passed — same convention as
// migrateCapitalPoolSeparation.js and backfillLedger.js.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { round2 } = require("../config/rates");

// Writes off three specific, already-investigated historical overpayments
// that have no "other half" to complete (unlike Bethlehem/Hilina/Guta's
// Capital-principal gap, which scripts/reclassifyCapitalWithdrawals.js fixes
// by correcting the real withdrawal record itself — run that first).
// A Math.max(0, ...) floor only hides these from the screen; it does not
// resolve the fact that an organizer's true balance is negative. Nothing here
// is auto-detected — every correction below is a deliberate, reviewed action
// tied to a specific diagnosed incident, not a generic "find and zero out any
// negative account" sweep (which would risk silently masking a NEW, real bug
// instead of surfacing it).
//
//   - Kidus Fikadu (68a72cade1b4058e0011f1ec): a staff-created withdrawal
//     overpayment, documented since the 2026-08-13 audit.
//   - Nahom Getu (690cae3722e77b904d616656): the pending-ticket-revenue bug
//     (fixed going forward in ticketRevenueQuery.js) whose payout already
//     went out before the fix landed.
//   - Bethlehem Abraham (68efb554372f82851d1535a3): same pending-ticket bug
//     as Nahom's — 11 tickets, 5,500 gross. Separate from, and independent
//     of, her Capital-principal gap (reclassifyCapitalWithdrawals.js).
// Each organizer's current true deficit is recomputed live (never assumed
// from a past audit) and sanity-bounded before writing, so a stale or
// unexpectedly large number aborts instead of silently writing something
// wrong.
//
//   node src/scripts/reconcileNegativeBalances.js            # report only
//   node src/scripts/reconcileNegativeBalances.js --write    # apply

const args = process.argv.slice(2);
const WRITE = args.includes("--write");

const WRITE_OFFS = [
  {
    organizerId: "68a72cade1b4058e0011f1ec",
    label: "Kidus Fikadu",
    currency: "ETB",
    expectedAround: -3298,
    reason:
      "Write-off: staff-created withdrawal overpayment (documented in the " +
      "2026-08-13 audit). No recovery path — approved as a one-time loss.",
  },
  {
    organizerId: "690cae3722e77b904d616656",
    label: "Nahom Getu",
    currency: "ETB",
    expectedAround: -1746,
    reason:
      "Write-off: paid out against tickets that were later flipped from " +
      "'pending' to 'expired' by the abandoned-checkout sweep (the " +
      "pending-ticket-revenue bug, fixed going forward in " +
      "utils/ticketRevenueQuery.js's EXCLUDED_TICKET_STATUS). No recovery " +
      "path — approved as a one-time loss.",
  },
  {
    // Run scripts/reclassifyCapitalWithdrawals.js FIRST — it corrects her
    // Capital-principal gap by editing the real withdrawal record itself, so
    // by the time this runs, her only remaining deficit should be this
    // -5,335, not the combined -85,335 both issues once produced together.
    organizerId: "68efb554372f82851d1535a3",
    label: "Bethlehem Abraham",
    currency: "ETB",
    expectedAround: -5335,
    reason:
      "Write-off: paid out against tickets that were later flipped from " +
      "'pending' to 'expired' by the abandoned-checkout sweep (the " +
      "pending-ticket-revenue bug, fixed going forward in " +
      "utils/ticketRevenueQuery.js's EXCLUDED_TICKET_STATUS) — 11 tickets, " +
      "5,500 gross. Separate from, and independent of, her Capital-principal " +
      "gap (see reclassifyCapitalWithdrawals.js). No recovery path — " +
      "approved as a one-time loss.",
  },
];

// A write-off aborts if the live number has drifted more than this far from
// what was diagnosed — a guard against writing a stale or wrong amount, not
// a real tolerance requirement.
const SANITY_BAND = 500;

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}\n`);

  const BalanceAdjustment = require("../models/BalanceAdjustment");
  const { calculateOrganizerBalance } = require("../services/financeService");

  const rawTicketDeficit = async (organizerId, currency) => {
    const data = await calculateOrganizerBalance(organizerId, currency);
    const t = data.streams.tickets;
    return round2(
      t.organizerRevenue -
        data.loan.totalRepaidFromTickets -
        (t.pendingWithdrawals + t.approvedWithdrawals) +
        t.adjustments
    );
  };

  const toApply = [];

  console.log("=".repeat(78));
  console.log("Write off diagnosed historical overpayments");
  console.log("=".repeat(78));

  for (const w of WRITE_OFFS) {
    const reference = `writeoff:${w.organizerId}:${w.currency}`;
    const exists = await BalanceAdjustment.findOne({ reference }).lean();
    if (exists) {
      console.log(`  ${w.label}  already written off (${reference}) — skipping`);
      continue;
    }

    const raw = await rawTicketDeficit(w.organizerId, w.currency);
    if (raw >= -0.01) {
      console.log(`  ${w.label}  is no longer negative (${raw.toFixed(2)} ${w.currency}) — nothing to write off`);
      continue;
    }
    if (Math.abs(raw - w.expectedAround) > SANITY_BAND) {
      console.log(
        `  ${w.label}  ABORTED — live deficit ${raw.toFixed(2)} ${w.currency} is too far from the ` +
          `expected ~${w.expectedAround} (band ${SANITY_BAND}). Investigate before writing anything — ` +
          "did reclassifyCapitalWithdrawals.js --write run first?"
      );
      continue;
    }

    const amount = round2(-raw);
    console.log(`  ${w.label}  credit ${amount.toFixed(2)} ${w.currency} (live deficit: ${raw.toFixed(2)})`);
    toApply.push({
      organizer: w.organizerId,
      stream: "tickets",
      currency: w.currency,
      amount,
      reason: w.reason,
      reference,
    });
  }

  console.log(`\nTotal corrections to write: ${toApply.length}`);
  console.log(`Total amount: ${round2(toApply.reduce((s, a) => s + a.amount, 0)).toFixed(2)} ETB\n`);

  if (WRITE && toApply.length > 0) {
    console.log("Writing corrections...");
    for (const adj of toApply) {
      try {
        await BalanceAdjustment.create(adj);
        console.log(`  wrote ${adj.reference}`);
      } catch (error) {
        console.error(`  FAILED ${adj.reference}: ${error.message}`);
      }
    }
  } else if (toApply.length > 0) {
    console.log("Dry run — nothing written. Re-run with --write to apply.");
  }

  console.log("");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Reconciliation failed:", error);
  process.exit(1);
});
