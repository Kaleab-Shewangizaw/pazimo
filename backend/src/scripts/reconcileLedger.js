const mongoose = require("mongoose");

// This is a read-only diagnostic.
//
// Mongoose builds a model's indexes on first use, which is a WRITE. Against a
// production replica with a read-only credential that fails noisily; against
// one with write access it would quietly reshape indexes on live collections
// as a side effect of running a report. Neither is acceptable for a diagnostic,
// so index management is left to the application that owns it.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { toMajor, formatMinor, toMinor } = require("../utils/money");

// Compare the ledger against the balance formulas it is meant to replace.
//
// REBUILD_PLAN Phase 3 gates the cutover on the two agreeing for seven days of
// dual-write. This is the check that gate is measured with: it reads every
// seller's balance BOTH ways and reports any disagreement, per owner and per
// pool.
//
// Read-only. It never writes, so it is safe to run against production and safe
// to run on a schedule.
//
//   node src/scripts/reconcileLedger.js
//   node src/scripts/reconcileLedger.js --verbose   # print agreeing rows too
//
// A difference of a cent or two is not automatically a bug: the old formulas
// round per aggregation in floating point while the ledger is exact integers,
// so the ledger is the more correct of the two. What matters is that
// differences stay in that range and do not grow — a difference of thousands
// means a channel is being counted twice or not at all.

const VERBOSE = process.argv.includes("--verbose");

/**
 * How far apart the two methods may legitimately be.
 *
 * The ledger rounds VAT and commission ONCE PER SALE, because an integer ledger
 * has to — you cannot store a third of a cent, and money that is charged per
 * transaction is rounded per transaction. The old formulas sum in floating
 * point across every row and round once at the very end.
 *
 * Neither is wrong; they are different methods, and the ledger is the one that
 * matches what was actually charged. But it means a fixed tolerance is the
 * wrong shape: the gap grows with the NUMBER of entries, not with their value.
 * Each entry can contribute at most half a minor unit of rounding, so the
 * honest bound is half the entry count.
 *
 * A difference beyond that is not rounding — it means a channel is being
 * counted twice, or not at all, or a whole class of movement is missing (which
 * is exactly how the Pazimo Capital omission was found).
 */
const toleranceFor = (entryCount) => Math.max(2, Math.ceil((entryCount || 0) / 2));

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}\n`);

  const LedgerBalance = require("../models/LedgerBalance");
  const { calculateOrganizerBalance, calculateVenueBalance } = require("../services/financeService");
  const { calculateCinemaBalance } = require("../services/cinemaFinanceService");
  const User = require("../models/User");

  const rows = [];
  const ledgerFor = async (kind, id, stream) => {
    const doc = await LedgerBalance.findOne({
      "owner.kind": kind, "owner.id": id, currency: "ETB", stream,
    }).lean();
    return doc
      ? { minor: doc.availableMinor, entries: doc.entryCount }
      : { minor: 0, entries: 0 };
  };

  const compare = (label, oldValue, ledger) => {
    const oldMinor = toMinor(oldValue || 0);
    const diff = ledger.minor - oldMinor;
    rows.push({
      label,
      oldMinor,
      ledgerMinor: ledger.minor,
      diff,
      tolerance: toleranceFor(ledger.entries),
    });
  };

  // --- Organizers ---------------------------------------------------------
  const organizers = await User.find({ role: "organizer" }).select("_id firstName lastName").lean();
  console.log(`Checking ${organizers.length} organizer(s)...`);
  for (const o of organizers) {
    const balance = await calculateOrganizerBalance(o._id, "ETB");
    const name = `${o.firstName || ""} ${o.lastName || ""}`.trim() || String(o._id);
    compare(`organizer ${name} · tickets`, balance.streams?.tickets?.availableBalance,
      await ledgerFor("organizer", o._id, "tickets"));
    compare(`organizer ${name} · beverages`, balance.streams?.beverages?.availableBalance,
      await ledgerFor("organizer", o._id, "beverages"));
    compare(`organizer ${name} · capital`, balance.streams?.capital?.availableBalance,
      await ledgerFor("organizer", o._id, "capital"));
  }

  // --- Venues -------------------------------------------------------------
  let Venue;
  try { Venue = require("../models/Venue"); } catch { Venue = null; }
  if (Venue) {
    const venues = await Venue.find({}).select("_id name").lean();
    console.log(`Checking ${venues.length} venue(s)...`);
    for (const v of venues) {
      const balance = await calculateVenueBalance(v._id, "ETB");
      compare(`venue ${v.name} · beverages`,
        balance.streams?.venueBeverages?.availableBalance,
        await ledgerFor("venue", v._id, "beverages"));
    }
  }

  // --- Cinemas ------------------------------------------------------------
  let Cinema;
  try { Cinema = require("../models/Cinema"); } catch { Cinema = null; }
  if (Cinema) {
    const cinemas = await Cinema.find({}).select("_id name").lean();
    console.log(`Checking ${cinemas.length} cinema(s)...`);
    for (const c of cinemas) {
      const balance = await calculateCinemaBalance(c._id, "ETB");
      compare(`cinema ${c.name} · tickets`, balance.streams?.tickets?.availableBalance,
        await ledgerFor("cinema", c._id, "tickets"));
      compare(`cinema ${c.name} · beverages`, balance.streams?.beverages?.availableBalance,
        await ledgerFor("cinema", c._id, "beverages"));
    }
  }

  // --- Report -------------------------------------------------------------
  const disagreements = rows.filter((r) => Math.abs(r.diff) > r.tolerance);
  const withinTolerance = rows.filter(
    (r) => r.diff !== 0 && Math.abs(r.diff) <= r.tolerance
  );

  console.log("\n" + "=".repeat(78));
  console.log("LEDGER vs EXISTING FORMULAS");
  console.log("=".repeat(78));

  const show = (r) =>
    console.log(
      r.label.padEnd(40) +
        formatMinor(r.oldMinor, "ETB").padStart(15) +
        formatMinor(r.ledgerMinor, "ETB").padStart(15) +
        (r.diff === 0
          ? "  ok"
          : `  ${formatMinor(r.diff, "ETB")} (tol ${formatMinor(r.tolerance, "ETB")})`)
    );

  console.log("Owner · pool".padEnd(40) + "existing".padStart(15) + "ledger".padStart(15) + "  diff");
  console.log("-".repeat(78));

  if (disagreements.length) {
    console.log("\nDISAGREEMENTS (beyond rounding):");
    disagreements.forEach(show);
  }
  if (withinTolerance.length) {
    console.log(
      "\nWithin per-transaction rounding tolerance (the ledger is what was actually charged):"
    );
    withinTolerance.forEach(show);
  }
  if (VERBOSE) {
    console.log("\nExact agreement:");
    rows.filter((r) => r.diff === 0).forEach(show);
  }

  console.log("\n" + "-".repeat(78));
  console.log(`  compared           : ${rows.length}`);
  console.log(`  exact agreement    : ${rows.filter((r) => r.diff === 0).length}`);
  console.log(`  within tolerance   : ${withinTolerance.length}`);
  console.log(`  DISAGREEMENTS      : ${disagreements.length}`);
  console.log(
    "\n" +
      (disagreements.length === 0
        ? "AGREED — safe to keep dual-writing. Cut reads over once this has held for the gate period."
        : "NOT AGREED — do not cut reads over. Investigate the rows above.")
  );
  console.log("");

  await mongoose.disconnect();
  process.exit(disagreements.length === 0 ? 0 : 1);
};

run().catch((error) => {
  console.error("Reconcile failed:", error);
  process.exit(1);
});
