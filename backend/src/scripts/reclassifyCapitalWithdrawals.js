const mongoose = require("mongoose");

// Read-only unless --write is passed — same convention as every other script
// here.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Replaces reconcileNegativeBalances.js's Part 1 (the synthetic ticket-side
// BalanceAdjustment credit) with something more honest: the REAL historical
// withdrawal that happened at Capital disbursement time is edited to show
// what it actually was, instead of leaving it on "tickets" and papering over
// the gap with a separate correction entry dated the day the migration ran.
//
// Two shapes, decided per organizer by whether a single real withdrawal maps
// cleanly onto their exact loan principal:
//
//   FULL reclassification (Guta, Hilina) — one withdrawal, whole-history math
//   confirms 100% of it is unaccounted for by real ticket revenue (every
//   other withdrawal they ever made already consumes all of it), so the
//   whole withdrawal becomes a capital withdrawal. Verified computationally,
//   not assumed from the amount matching alone — see the chat record: a
//   naive "how much ticket balance did she have at that exact moment" check
//   is NOT sufficient on its own (money in an ongoing stream is fungible; an
//   unspent point-in-time balance can get rolled forward into a LATER
//   withdrawal instead), only the whole-history reconciliation is reliable.
//
//   PARTIAL split (Bethlehem) — no single withdrawal equals her 80,000
//   principal, so her same-day, 5-minutes-after-disbursement withdrawal is
//   split into two real records at the SAME original timestamp: the
//   principal amount becomes its own capital withdrawal, the remainder stays
//   a ticket withdrawal. Her separate -5,335 (an unrelated, already-diagnosed
//   pending-ticket-revenue bug) is NOT part of this script — still handled by
//   reconcileNegativeBalances.js's write-off.
//
// Each synthetic "Migration: ..." bookkeeping withdrawal these replace is
// deleted, since a real, correctly-attributed record now exists instead.
//
//   node src/scripts/reclassifyCapitalWithdrawals.js            # report only
//   node src/scripts/reclassifyCapitalWithdrawals.js --write    # apply

const args = process.argv.slice(2);
const WRITE = args.includes("--write");

const CASES = [
  {
    label: "Guta Wakuma Chimsa",
    organizerId: "6aaa979c6e88b6e4197ff928",
    realWithdrawalId: "6aae5593aee7b79bfb9fcbd1",
    syntheticWithdrawalId: "6ab6e1672e0c04d1ce6cb5fc",
    totalAmount: 150000,
    capitalAmount: 150000, // full reclassification — nothing stays on tickets
  },
  {
    label: "Hilina Gezahegne",
    organizerId: "69dcb0f19abd6f19753e6974",
    realWithdrawalId: "6a7c3f7085753fd255ed4301",
    syntheticWithdrawalId: "6ab6e1652e0c04d1ce6cb5f1",
    totalAmount: 100000,
    capitalAmount: 100000, // full reclassification
  },
  {
    label: "Bethlehem Abraham",
    organizerId: "68efb554372f82851d1535a3",
    realWithdrawalId: "6a79e64385753fd255e03ab9",
    syntheticWithdrawalId: "6ab6e1642e0c04d1ce6cb5e6",
    totalAmount: 150000,
    capitalAmount: 80000, // partial split — 70,000 stays a real ticket withdrawal
  },
];

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}\n`);

  const Withdrawal = require("../models/Withdrawal");
  const { calculateOrganizerBalance } = require("../services/financeService");
  const { round2 } = require("../config/rates");

  for (const c of CASES) {
    console.log("=".repeat(78));
    console.log(c.label);
    console.log("=".repeat(78));

    const real = await Withdrawal.findById(c.realWithdrawalId);
    const synthetic = await Withdrawal.findById(c.syntheticWithdrawalId);

    if (!real) {
      console.log(`  ABORTED — real withdrawal ${c.realWithdrawalId} not found.`);
      continue;
    }
    if (real.amount !== c.totalAmount) {
      console.log(
        `  ABORTED — expected real withdrawal amount ${c.totalAmount}, found ${real.amount}. Investigate before touching this.`
      );
      continue;
    }
    if (!synthetic) {
      console.log(`  NOTE — synthetic withdrawal ${c.syntheticWithdrawalId} not found (maybe already removed).`);
    } else if (synthetic.amount !== c.capitalAmount) {
      // Expected, not an error: the synthetic entry was computed by
      // migrateCapitalPoolSeparation.js's migration-time snapshot method,
      // which this script's whole-history verification supersedes (see the
      // Guta case — computed 141,851.30 there, but the correct figure,
      // confirmed against her full history, is the full 150,000). Logged for
      // visibility, not treated as a mismatch to abort on.
      console.log(
        `  NOTE — synthetic entry recorded ${synthetic.amount} (migration-time estimate); ` +
          `this script's whole-history-verified figure is ${c.capitalAmount}.`
      );
    }

    const keepOnTickets = round2(c.totalAmount - c.capitalAmount);
    console.log(`  Real withdrawal ${real._id}: ${real.amount} (currently stream "${real.stream || "tickets"}")`);
    console.log(`  -> becomes: ${keepOnTickets} tickets` + (keepOnTickets > 0 ? "" : " (nothing — full reclassification)"));
    console.log(`  -> plus a new capital withdrawal: ${c.capitalAmount}, dated ${real.createdAt.toISOString()} (the real disbursement moment)`);
    if (synthetic) console.log(`  Deletes redundant synthetic entry ${synthetic._id} (${synthetic.amount}, dated ${synthetic.createdAt.toISOString()})`);

    // The "before" read, projected analytically to a "would become" figure —
    // NOT a second live query. A dry run against a read-only credential can't
    // simulate the write via a transaction (even a rolled-back one requires
    // write permission to open), so this projects the same formula
    // financeService.js uses, by hand, off the numbers already fetched.
    const before = await calculateOrganizerBalance(c.organizerId, "ETB");
    const t = before.streams.tickets;
    const cap = before.streams.capital;

    const projectedTicketWithdrawn = round2(t.approvedWithdrawals - c.totalAmount + keepOnTickets);
    const projectedTicketRaw = round2(
      t.organizerRevenue - before.loan.totalRepaidFromTickets - (t.pendingWithdrawals + projectedTicketWithdrawn) + t.adjustments
    );
    const syntheticAmount = synthetic ? synthetic.amount : 0;
    const projectedCapitalWithdrawn = round2(cap.approvedWithdrawals - syntheticAmount + c.capitalAmount);
    const projectedCapitalRaw = round2(
      cap.principalCredited - (cap.pendingWithdrawals + projectedCapitalWithdrawn) + cap.adjustments
    );

    console.log(
      `  ${WRITE ? "" : "Projected "}available balance: ` +
        `tickets ${Math.max(0, projectedTicketRaw)} (raw ${projectedTicketRaw}), ` +
        `capital ${Math.max(0, projectedCapitalRaw)} (raw ${projectedCapitalRaw})`
    );

    if (WRITE) {
      if (keepOnTickets > 0) {
        // Partial split: shrink the real record to its genuine ticket portion,
        // create a sibling capital withdrawal at the SAME original timestamp.
        real.amount = keepOnTickets;
        real.netAmount = keepOnTickets;
        real.stream = "tickets";
        real.notes =
          (real.notes ? real.notes + " " : "") +
          `[Split ${new Date().toISOString().slice(0, 10)}: originally recorded as ${c.totalAmount}; ` +
          `${c.capitalAmount} of it was Pazimo Capital principal, moved to its own withdrawal record below.]`;
        await real.save();

        await Withdrawal.create({
          organizer: c.organizerId,
          stream: "capital",
          amount: c.capitalAmount,
          currency: "ETB",
          status: "approved",
          netAmount: c.capitalAmount,
          createdAt: real.createdAt,
          processedAt: real.processedAt || real.createdAt,
          notes:
            `Split from ticket withdrawal ${real._id} on ${new Date().toISOString().slice(0, 10)}: ` +
            "this organizer's Capital principal was disbursed through the ticket " +
            "withdrawal flow before Capital became a separate pool. This record " +
            "reflects the real disbursement date and amount, replacing the " +
            "earlier bookkeeping-only placeholder.",
        });
      } else {
        // Full reclassification: the whole withdrawal IS the capital draw.
        real.stream = "capital";
        real.notes =
          (real.notes ? real.notes + " " : "") +
          `[Reclassified ${new Date().toISOString().slice(0, 10)}: this was Pazimo Capital ` +
          "principal disbursed through the ticket withdrawal flow before Capital " +
          "became a separate pool, not real ticket revenue.]";
        await real.save();
      }

      if (synthetic) {
        await Withdrawal.deleteOne({ _id: synthetic._id });
      }

      // Only meaningful once the write above actually landed — a fresh,
      // real query against the now-changed database, not a projection.
      const after = await calculateOrganizerBalance(c.organizerId, "ETB");
      console.log(
        `  Confirmed: tickets ${after.streams.tickets.availableBalance}, capital ${after.streams.capital.availableBalance}`
      );
    }
    console.log("");
  }

  if (!WRITE) console.log("Dry run — nothing written. Re-run with --write to apply.");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Reclassification failed:", error);
  process.exit(1);
});
