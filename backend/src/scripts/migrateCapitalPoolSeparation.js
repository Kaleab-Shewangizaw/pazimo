const mongoose = require("mongoose");

// Read-only unless --write is passed. See backfillLedger.js for the same
// convention and the same reasoning: index management is left to the
// application that owns it, so a diagnostic run never mutates anything by
// accident.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { round2 } = require("../config/rates");

// One-time reconciliation for Pazimo Capital's pool separation.
//
// Before this change, a loan's principal was credited straight into the
// organizer's TICKET balance (financeService.calculateOrganizerBalance used
// to add loanFinance.principalCredited into ticketAvailableBalance). The only
// way to withdraw a Capital advance was through the ordinary ticket
// withdrawal flow. Now the principal lives in its own "capital" pool instead,
// and the ticket formula no longer adds it in.
//
// For an organizer who took a loan but never requested a ticket withdrawal,
// this is a pure relabeling: the same money just moved from one column to
// another, nothing to reconcile.
//
// For an organizer who DID withdraw ticket money while carrying a loan, some
// of what they were paid under the old formula could only have come from the
// borrowed principal (their real ticket earnings alone wouldn't cover it).
// Without this script, that history is invisible to the new capitalAvailable
// pool, which would report the FULL principal as still unwithdrawn — letting
// the same money be paid out a second time.
//
// This script finds that already-drawn amount per organizer and, on --write,
// records it as a completed "capital" withdrawal (a bookkeeping entry, no
// real money moves) so capitalAvailableBalance correctly reads
// principal - alreadyDrawn instead of the full, wrong principal.
//
//   node src/scripts/migrateCapitalPoolSeparation.js            # report only
//   node src/scripts/migrateCapitalPoolSeparation.js --write    # apply

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CURRENCY = args.includes("--usd") ? "USD" : "ETB";

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Currency: ${CURRENCY}   Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}\n`);

  const Loan = require("../models/Loan");
  const Withdrawal = require("../models/Withdrawal");
  const { calculateOrganizerBalance } = require("../services/financeService");
  const { mirrorWithdrawal } = require("../services/ledgerDualWrite");

  // Only organizers who ever had money credited via Capital are in scope —
  // everyone else's ticket balance is unaffected by this change.
  const borrowerIds = await Loan.distinct("organizer", {
    currency: CURRENCY,
    status: { $in: ["active", "repaid"] },
  });
  console.log(`Checking ${borrowerIds.length} organizer(s) with a Pazimo Capital history...\n`);

  const affected = [];

  for (const organizerId of borrowerIds) {
    // Reuses the live, already-updated formula rather than re-deriving the
    // math here a second time — this run's numbers are guaranteed to match
    // what the app will show the moment this migration lands.
    const balance = await calculateOrganizerBalance(organizerId, CURRENCY);
    const tickets = balance.streams.tickets;
    const capital = balance.streams.capital;

    if (!capital.principalCredited) continue;

    // What the new formula considers "real" ticket earnings, before
    // withdrawals are subtracted — i.e. organizerRevenue minus the automatic
    // debt cut, with none of the old principal mixed in.
    const ticketRevenueAvailable = round2(
      Math.max(0, tickets.organizerRevenue - capital.totalRepaidFromTickets)
    );

    // Only APPROVED/COMPLETED ticket withdrawals count as money that actually
    // left — a pending request never disbursed anything.
    const alreadyPaidOut = tickets.approvedWithdrawals;

    const principalAlreadyDrawn = round2(
      Math.min(
        capital.principalCredited,
        Math.max(0, alreadyPaidOut - ticketRevenueAvailable)
      )
    );

    if (principalAlreadyDrawn <= 0) continue;

    affected.push({ organizerId, principalAlreadyDrawn, capital, tickets });
  }

  console.log("=".repeat(78));
  console.log("ORGANIZERS AFFECTED (principal already paid out via the old ticket pool)");
  console.log("=".repeat(78));

  if (affected.length === 0) {
    console.log("None. Nothing to migrate — every borrower's principal is still fully");
    console.log("unwithdrawn under the new capital pool, or was never mixed with a ticket");
    console.log("withdrawal in the first place.");
  } else {
    for (const row of affected) {
      console.log(
        `  organizer ${row.organizerId}` +
          `  already drawn: ${row.principalAlreadyDrawn.toFixed(2)} ${CURRENCY}` +
          `  (principal ${row.capital.principalCredited.toFixed(2)},` +
          ` ticket withdrawals approved ${row.tickets.approvedWithdrawals.toFixed(2)})`
      );
    }
  }

  console.log(`\n  organizers affected  : ${affected.length}`);
  console.log(
    `  total to reconcile   : ${affected.reduce((s, r) => s + r.principalAlreadyDrawn, 0).toFixed(2)} ${CURRENCY}`
  );

  if (WRITE && affected.length > 0) {
    console.log("\nWriting reconciling entries...");
    for (const row of affected) {
      const now = new Date();
      const withdrawal = await Withdrawal.create({
        organizer: row.organizerId,
        stream: "capital",
        amount: row.principalAlreadyDrawn,
        currency: CURRENCY,
        status: "approved",
        processedAt: now,
        netAmount: row.principalAlreadyDrawn,
        notes:
          "Migration: principal already paid out via the ticket pool before " +
          "Pazimo Capital became a separate withdrawal pool. No money moved — " +
          "this is a bookkeeping entry so the capital balance reflects history.",
      });

      await mirrorWithdrawal({
        owner: { kind: "organizer", id: row.organizerId },
        stream: "capital",
        amount: row.principalAlreadyDrawn,
        withdrawalId: withdrawal._id,
        currency: CURRENCY,
        occurredAt: now,
      });
    }
    console.log(`Wrote ${affected.length} reconciling entr${affected.length === 1 ? "y" : "ies"}.`);
  } else if (affected.length > 0) {
    console.log("\nDry run — nothing written. Re-run with --write to apply.");
  }

  console.log("");
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
