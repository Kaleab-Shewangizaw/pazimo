const mongoose = require("mongoose");

// Read-only unless --write is passed — same convention as
// migrateCapitalPoolSeparation.js and backfillLedger.js.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { round2 } = require("../config/rates");

// Closes two specific, already-investigated negative-balance cases by writing
// explicit BalanceAdjustment corrections (see models/BalanceAdjustment.js).
// A Math.max(0, ...) floor only hides these from the screen; it does not
// resolve the fact that an organizer's true balance is negative. Nothing here
// is auto-detected — every correction below is a deliberate, reviewed action
// tied to a specific diagnosed incident, not a generic "find and zero out any
// negative account" sweep (which would risk silently masking a NEW, real bug
// instead of surfacing it).
//
// PART 1 — complete migrateCapitalPoolSeparation.js.
// That script correctly debited the Capital pool for principal an organizer
// had already drawn through the old, pre-separation ticket withdrawal flow,
// so it can't be double-withdrawn — but it never credited the ticket pool
// back for that same amount, even though its own comment describes the fix
// as "the same money just moved from one column to another." This finds
// every reconciling capital withdrawal that migration wrote and adds the
// matching ticket-side credit, for the EXACT amount already recorded there
// (never re-derived), so the two numbers can never drift apart.
//
// PART 2 — write off two specific historical overpayments that have no
// "other half" to complete:
//   - Kidus Fikadu (68a72cade1b4058e0011f1ec): a staff-created withdrawal
//     overpayment, documented since the 2026-08-13 audit.
//   - Nahom Getu (690cae3722e77b904d616656): the pending-ticket-revenue bug
//     (fixed going forward in ticketRevenueQuery.js) whose payout already
//     went out before the fix landed.
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
    // Same bug class as Nahom, and same organizer as Part 1's 80,000 capital
    // credit above — her live raw deficit right now is -85,335 (-80,000 not
    // yet applied when this runs + -5,335 this write-off targets). The Part 1
    // credit is accounted for via `stagedFor` below, so only the remaining
    // -5,335 is written off here, never the full -85,335.
    organizerId: "68efb554372f82851d1535a3",
    label: "Bethlehem Abraham",
    currency: "ETB",
    expectedAround: -5335,
    reason:
      "Write-off: paid out against tickets that were later flipped from " +
      "'pending' to 'expired' by the abandoned-checkout sweep (the " +
      "pending-ticket-revenue bug, fixed going forward in " +
      "utils/ticketRevenueQuery.js's EXCLUDED_TICKET_STATUS) — 11 tickets, " +
      "5,500 gross. Separate from, and in addition to, the capital-pool " +
      "ticket-side credit applied to this same organizer above. No recovery " +
      "path — approved as a one-time loss.",
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

  const Withdrawal = require("../models/Withdrawal");
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

  // ---- Part 1: complete the capital-pool-separation migration ----------
  console.log("=".repeat(78));
  console.log("PART 1 — capital-pool-separation ticket-side credit");
  console.log("=".repeat(78));

  const migrationWithdrawals = await Withdrawal.find({
    stream: "capital",
    notes: /Migration: principal already paid out via the ticket pool/,
  }).lean();

  console.log(`Found ${migrationWithdrawals.length} reconciling capital withdrawal(s) from that migration.\n`);

  for (const wd of migrationWithdrawals) {
    const reference = `capital-pool-separation-ticket-credit:${wd._id}`;
    const exists = await BalanceAdjustment.findOne({ reference }).lean();
    if (exists) {
      console.log(`  organizer ${wd.organizer}  already credited (${reference}) — skipping`);
      continue;
    }
    console.log(
      `  organizer ${wd.organizer}  credit ${wd.amount.toFixed(2)} ${wd.currency} to the ticket pool` +
        ` (matches capital-side withdrawal ${wd._id})`
    );
    toApply.push({
      organizer: wd.organizer,
      stream: "tickets",
      currency: wd.currency,
      amount: wd.amount,
      reason:
        "Completes migrateCapitalPoolSeparation.js: credits back the ticket " +
        "pool for principal that was paid out through the old, pre-separation " +
        `ticket withdrawal flow (see the matching capital-side withdrawal ${wd._id}). ` +
        "No money moves — this corrects which pool it was already booked against.",
      reference,
    });
  }

  // ---- Part 2: write off the diagnosed overpayments ----------------------
  console.log("\n" + "=".repeat(78));
  console.log("PART 2 — write off diagnosed historical overpayments");
  console.log("=".repeat(78));

  // Every correction actually writes in one batch at the end, so a Part 1
  // credit for the SAME organizer (Bethlehem gets both) hasn't hit the
  // database yet when this loop reads her live balance — without accounting
  // for it here, her write-off would be computed against the pre-Part-1
  // deficit (-85,335) instead of what's left after it (-5,335), double
  // counting the 80,000 that Part 1 already covers.
  const stagedTicketCredit = (organizerId, currency) =>
    round2(
      toApply
        .filter(
          (a) =>
            String(a.organizer) === String(organizerId) &&
            a.currency === currency &&
            a.stream === "tickets"
        )
        .reduce((sum, a) => sum + a.amount, 0)
    );

  for (const w of WRITE_OFFS) {
    const reference = `writeoff:${w.organizerId}:${w.currency}`;
    const exists = await BalanceAdjustment.findOne({ reference }).lean();
    if (exists) {
      console.log(`  ${w.label}  already written off (${reference}) — skipping`);
      continue;
    }

    const liveRaw = await rawTicketDeficit(w.organizerId, w.currency);
    const staged = stagedTicketCredit(w.organizerId, w.currency);
    const raw = round2(liveRaw + staged);
    if (staged !== 0) {
      console.log(
        `  ${w.label}  live deficit ${liveRaw.toFixed(2)}, ${staged.toFixed(2)} already staged` +
          ` from Part 1 this run → ${raw.toFixed(2)} remaining`
      );
    }
    if (raw >= -0.01) {
      console.log(`  ${w.label}  is no longer negative (${raw.toFixed(2)} ${w.currency}) — nothing to write off`);
      continue;
    }
    if (Math.abs(raw - w.expectedAround) > SANITY_BAND) {
      console.log(
        `  ${w.label}  ABORTED — remaining deficit ${raw.toFixed(2)} ${w.currency} is too far from the ` +
          `expected ~${w.expectedAround} (band ${SANITY_BAND}). Investigate before writing anything.`
      );
      continue;
    }

    const amount = round2(-raw);
    console.log(`  ${w.label}  credit ${amount.toFixed(2)} ${w.currency} (remaining deficit: ${raw.toFixed(2)})`);
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
