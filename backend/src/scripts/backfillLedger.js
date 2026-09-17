const mongoose = require("mongoose");

// A dry run must be genuinely read-only.
//
// Mongoose builds a model's indexes on first use, which is a WRITE. Against a
// production replica with a read-only credential that fails noisily; against
// one with write access it would quietly reshape indexes on live collections
// as a side effect of running a report. Neither is acceptable for a diagnostic,
// so index management is left to the application that owns it.
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { toMinor, toMajor, formatMinor, splitSale } = require("../utils/money");
const { DEFAULT_COMMISSION_RATE } = require("../config/rates");

// Rebuild the ledger from the history that already exists.
//
// DRY RUN BY DEFAULT. Nothing is written unless --write is passed, because the
// first thing anyone should do with this is read the reconciliation report and
// check it against the figures they already trust.
//
//   node src/scripts/backfillLedger.js              # report only
//   node src/scripts/backfillLedger.js --write      # append entries
//
// REBUILD_PLAN Phase 3 sets the gate: the backfill must reconcile to
// **672,529.23** of Pazimo equity on production. That number is commission at
// 3% across all settled revenue, and it is the reason this script prints a
// full breakdown rather than just a success line — a backfill that lands the
// right total by two offsetting errors is not a correct backfill.
//
// Safe to re-run: sales and payouts are keyed off their own source row, so a
// second pass writes nothing new for those once recorded (see
// ledgerService.append). Two exceptions, both correctly re-evaluated every
// run: the correction pass below retracts a sale whose source row has since
// stopped being valid revenue, and Pazimo Capital's principal/repayment are
// cumulative positions that can still grow, so only the delta since last
// time is ever appended (see writeLoanDelta).

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CURRENCY = args.includes("--usd") ? "USD" : "ETB";

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Match a currency the way the data actually looks.
 *
 * `currency` was added to Withdrawal and Loan after both were in use, so rows
 * written before it exist with no value at all. A bare `{ currency: "ETB" }`
 * silently drops every one of them — and "silently" is the whole problem: the
 * backfill reports a clean PASS while the ledger is short, so an organizer's
 * balance reads HIGH by the payouts that were skipped.
 *
 * Measured on a production mirror: 62 approved withdrawals worth 7,502,480.50
 * ETB were being dropped this way. The ticket side never had the bug because
 * validTicketMatch has always matched "ETB or absent"; this brings the payout
 * and loan queries in line with it.
 *
 * USD is matched exactly: there is no era in which a USD row lacked the field,
 * so treating absent as USD would misfile every legacy ETB row.
 */
const currencyMatch = (currency) =>
  currency === "USD"
    ? { currency: "USD" }
    : {
        $or: [
          { currency: "ETB" },
          { currency: { $exists: false } },
          { currency: null },
        ],
      };

/**
 * Every source of money, described uniformly.
 *
 * Each channel differs only in which collection it reads, how it finds the
 * owner, and which field carries the withheld owner-VAT rate. Expressing that
 * as data rather than five near-identical loops is what stops one channel
 * quietly acquiring different arithmetic from the others — the exact drift the
 * ledger exists to end.
 */
const SOURCES = [
  {
    label: "Event tickets",
    model: "Ticket",
    stream: "tickets",
    ownerKind: "organizer",
    // Tickets carry no organizer; it comes from the event.
    resolveOwner: async (row, ctx) => ctx.organizerByEvent.get(String(row.event)),
    grossOf: (row) => row.price,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    // Not VAT_RATE — the row's OWN snapshot, or 0 for a row sold before the
    // field existed. Same reasoning as ticketRevenueQuery.js's revenueExprs.
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.organizerVatRate ?? 0,
    sourceRef: (row) => ({ ticket: row._id }),
    reference: (row) => `ticket:${row._id}`,
    select: "event price commissionRate vatRate organizerVatRate purchaseDate createdAt",
    occurredAt: (row) => row.purchaseDate || row.createdAt,
  },
  {
    label: "Event beverages",
    model: "BeverageSale",
    stream: "beverages",
    ownerKind: "organizer",
    resolveOwner: async (row) => row.organizer,
    grossOf: (row) => row.totalAmount,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.organizerVatRate ?? 0,
    sourceRef: (row) => ({ beverageSale: row._id }),
    reference: (row) => `beverage_sale:${row._id}`,
    select: "organizer totalAmount commissionRate vatRate organizerVatRate soldAt createdAt",
    occurredAt: (row) => row.soldAt || row.createdAt,
  },
  {
    label: "Venue beverages",
    model: "VenueBeverageSale",
    stream: "beverages",
    ownerKind: "venue",
    resolveOwner: async (row) => row.venue,
    grossOf: (row) => row.totalAmount,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.venueVatRate ?? 0,
    sourceRef: (row) => ({ venueBeverageSale: row._id }),
    reference: (row) => `venue_beverage_sale:${row._id}`,
    select: "venue totalAmount commissionRate vatRate venueVatRate soldAt createdAt",
    occurredAt: (row) => row.soldAt || row.createdAt,
  },
  {
    label: "Cinema tickets",
    model: "CinemaTicket",
    stream: "tickets",
    ownerKind: "cinema",
    resolveOwner: async (row) => row.cinema,
    grossOf: (row) => row.totalAmount,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.cinemaVatRate ?? 0,
    sourceRef: (row) => ({ cinemaTicket: row._id }),
    reference: (row) => `cinema_ticket:${row._id}`,
    select: "cinema totalAmount commissionRate vatRate cinemaVatRate purchaseDate createdAt",
    occurredAt: (row) => row.purchaseDate || row.createdAt,
  },
  {
    label: "Cinema concessions",
    model: "CinemaBeverageSale",
    stream: "beverages",
    ownerKind: "cinema",
    resolveOwner: async (row) => row.cinema,
    grossOf: (row) => row.totalAmount,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.cinemaVatRate ?? 0,
    sourceRef: (row) => ({ cinemaBeverageSale: row._id }),
    reference: (row) => `cinema_beverage_sale:${row._id}`,
    select: "cinema totalAmount commissionRate vatRate cinemaVatRate soldAt createdAt",
    occurredAt: (row) => row.soldAt || row.createdAt,
  },
];

/**
 * Which rows count as revenue, per channel.
 *
 * Deliberately the SAME predicates the existing revenue readers use — if the
 * backfill counted a different set the ledger would disagree with the figures
 * the business already relies on, and the reconciliation would be meaningless.
 */
const revenueFilter = (model, currency) => {
  if (model === "Ticket") {
    const { validTicketMatch } = require("../utils/ticketRevenueQuery");
    return validTicketMatch(currency);
  }
  if (model === "CinemaTicket") {
    const { validCinemaTicketMatch } = require("../utils/cinemaTicketRevenueQuery");
    return validCinemaTicketMatch(currency);
  }
  const { validBeverageSaleMatch } = require("../utils/beverageRevenueQuery");
  return validBeverageSaleMatch(currency);
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Currency: ${CURRENCY}   Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}\n`);

  const ledger = require("../services/ledgerService");
  const Event = require("../models/Event");

  // Tickets reference an event, not an organizer, so resolve that map once
  // rather than per ticket — the same reason ticketRevenueQuery resolves event
  // ids up front instead of $lookup-ing per row.
  const events = await Event.find({}).select("_id organizer").lean();
  const ctx = {
    organizerByEvent: new Map(events.map((e) => [String(e._id), e.organizer])),
  };
  console.log(`Resolved ${events.length} events for organizer lookup`);

  const totals = {
    gross: 0, commission: 0, vat: 0, ownerVat: 0, net: 0, rows: 0, skipped: 0,
  };
  const perChannel = [];

  for (const src of SOURCES) {
    let Model;
    try {
      Model = require(`../models/${src.model}`);
    } catch {
      console.log(`  ${src.label}: model not present, skipping`);
      continue;
    }

    const filter = revenueFilter(src.model, CURRENCY);

    // Project ONLY the fields the split needs, and stream rather than buffer.
    //
    // Not a micro-optimisation. On production the tickets collection is 522 MB
    // of which 99% is base64 QR images stored on each row (REBUILD_PLAN Phase 1,
    // never run) — so an unprojected read drags half a gigabyte across the wire
    // to sum a handful of numbers, and the backfill looks like it has hung.
    // Naming the fields makes it read about 5 MB instead.
    const rows = Model.find(filter).select(src.select).lean().cursor();

    const channel = {
      label: src.label, rows: 0, skipped: 0,
      gross: 0, commission: 0, vat: 0, ownerVat: 0, net: 0,
    };

    for await (const row of rows) {
      const ownerId = await src.resolveOwner(row, ctx);
      if (!ownerId) {
        // An orphan — a ticket whose event was deleted, say. Counted and
        // reported rather than silently dropped, because a backfill that
        // quietly loses rows is how a reconciliation ends up short.
        channel.skipped += 1;
        totals.skipped += 1;
        continue;
      }

      const grossMinor = toMinor(src.grossOf(row) || 0);
      if (grossMinor <= 0) { channel.skipped += 1; totals.skipped += 1; continue; }

      const split = splitSale({
        grossMinor,
        commissionRate: src.commissionRateOf(row),
        vatRate: src.vatRateOf(row),
        ownerVatRate: src.ownerVatRateOf(row),
      });

      channel.rows += 1;
      channel.gross += split.grossMinor;
      channel.commission += split.commissionMinor;
      channel.vat += split.vatMinor;
      channel.ownerVat += split.ownerVatMinor;
      channel.net += split.netMinor;

      if (WRITE) {
        await ledger.recordSale({
          owner: { kind: src.ownerKind, id: ownerId },
          currency: CURRENCY,
          stream: src.stream,
          grossAmount: src.grossOf(row),
          commissionRate: src.commissionRateOf(row),
          vatRate: src.vatRateOf(row),
          ownerVatRate: src.ownerVatRateOf(row),
          source: { ...src.sourceRef(row), note: "backfill" },
          reference: src.reference(row),
          occurredAt: src.occurredAt(row),
        });
      }
    }

    perChannel.push(channel);
    totals.rows += channel.rows;
    totals.gross += channel.gross;
    totals.commission += channel.commission;
    totals.vat += channel.vat;
    totals.ownerVat += channel.ownerVat;
    totals.net += channel.net;
  }

  // --- Correction: reverse sales whose source row is no longer valid -------
  //
  // A row can pass revenueFilter when it's first backfilled/mirrored and stop
  // passing it later — a stock-hold-expiry sweep (paymentHold.js) discovers a
  // "pending" ticket was never actually paid for and flips it to expired days
  // after the fact, say. The loop above only ever ADDS entries (matching
  // ledger.append's own idempotency — a source row already recorded is never
  // touched again), so nothing has ever retracted one of these once its row
  // stops being valid revenue. Found 2026-09-16 via the reconciler on
  // production: three organizers each carrying a handful of stale
  // ticket_sale entries for tickets that expired after the original
  // 2026-08-20 backfill ran.
  //
  // Reverses the EXACT amount already on record for that source (summed from
  // the entries themselves, not recomputed from today's rates — the reversal
  // must cancel exactly what was recorded, whatever rate was live when it
  // was), as a single `refund` entry. Idempotent: keyed off the source id, so
  // a row already reversed is skipped on a re-run.
  const LedgerEntry = require("../models/LedgerEntry");
  let correctionRows = 0, correctionMinor = 0;

  for (const src of SOURCES) {
    let Model;
    try {
      Model = require(`../models/${src.model}`);
    } catch {
      continue;
    }

    const saleKind = src.stream === "beverages" ? "beverage_sale" : "ticket_sale";
    const refKey = Object.keys(src.sourceRef({ _id: null }))[0];

    const recordedIds = await LedgerEntry.distinct(`source.${refKey}`, {
      kind: saleKind,
      stream: src.stream,
      "owner.kind": src.ownerKind,
      currency: CURRENCY,
    });
    if (!recordedIds.length) continue;

    const stillValidIds = new Set(
      (
        await Model.find({ _id: { $in: recordedIds }, ...revenueFilter(src.model, CURRENCY) })
          .select("_id")
          .lean()
      ).map((d) => String(d._id))
    );

    const invalidIds = recordedIds.filter((id) => !stillValidIds.has(String(id)));

    for (const invalidId of invalidIds) {
      const entries = await LedgerEntry.find({ [`source.${refKey}`]: invalidId }).lean();

      // recordSale writes to TWO owners per sale: the seller (organizer/
      // venue/cinema) and a mirrored commission-only entry under `platform`
      // (see recordSale's "Mirror onto Pazimo's own books"). Both share this
      // same source.ticket reference, so summing every entry regardless of
      // owner double-counted the commission into the organizer's reversal —
      // caught by the reconciler still disagreeing (by exactly the
      // commission amount) after the first version of this correction ran.
      // Grouping by owner and reversing each group separately is what keeps
      // the seller's reversal and the platform's reversal correct
      // independently.
      const byOwner = new Map();
      for (const e of entries) {
        const key = `${e.owner.kind}:${e.owner.id}`;
        if (!byOwner.has(key)) byOwner.set(key, { owner: e.owner, netMinor: 0 });
        byOwner.get(key).netMinor += e.amountMinor;
      }

      for (const [ownerKey, { owner, netMinor }] of byOwner) {
        if (netMinor === 0) continue; // already reversed, or nothing to reverse

        correctionRows += 1;
        correctionMinor += netMinor;

        if (WRITE) {
          await ledger.append({
            owner,
            currency: CURRENCY,
            stream: src.stream,
            kind: "refund",
            amountMinor: Math.abs(netMinor),
            source: { [refKey]: invalidId, note: "backfill: source row no longer valid revenue" },
            idempotencyKey: `refund:invalidated:${src.reference({ _id: invalidId })}:${ownerKey}`,
            occurredAt: new Date(),
          });
        }
      }
    }
  }

  // --- Withdrawals ---------------------------------------------------------
  const Withdrawal = require("../models/Withdrawal");
  const STREAM_OF = {
    tickets: "tickets", beverages: "beverages",
    venue_beverages: "beverages",
    cinema_tickets: "tickets", cinema_beverages: "beverages",
  };
  const OWNER_OF = {
    tickets: "organizer", beverages: "organizer",
    venue_beverages: "venue",
    cinema_tickets: "cinema", cinema_beverages: "cinema",
  };

  const payouts = await Withdrawal.find({
    ...currencyMatch(CURRENCY),
    status: { $in: ["pending", "approved", "completed"] },
  }).lean();

  let withdrawnMinor = 0, pendingMinor = 0, payoutRows = 0, payoutSkipped = 0;
  for (const w of payouts) {
    const stream = STREAM_OF[w.stream || "tickets"];
    const ownerKind = OWNER_OF[w.stream || "tickets"];
    const ownerId =
      ownerKind === "venue" ? w.venue : ownerKind === "cinema" ? w.cinema : w.organizer;
    if (!ownerId) { payoutSkipped += 1; continue; }

    const amountMinor = toMinor(w.amount || 0);
    if (amountMinor <= 0) { payoutSkipped += 1; continue; }

    payoutRows += 1;
    if (w.status === "pending") pendingMinor += amountMinor;
    else withdrawnMinor += amountMinor;

    if (WRITE) {
      await ledger.append({
        owner: { kind: ownerKind, id: ownerId },
        currency: CURRENCY,
        stream,
        kind: "withdrawal",
        amountMinor,
        source: { withdrawal: w._id, note: "backfill" },
        idempotencyKey: `withdrawal:${w._id}`,
        occurredAt: w.processedAt || w.createdAt,
      });
    }
  }

  // --- Pazimo Capital -----------------------------------------------------
  //
  // An advance is credited into the ticket pool as spendable money and repaid
  // from a cut of later ticket sales, so both legs move the organizer's ticket
  // balance and both must appear in the ledger. Omitting them was the first
  // disagreement the reconciler found: the ledger read high by exactly the
  // repayment taken.
  //
  // Capital is organizer-and-tickets only, by design — an advance is
  // underwritten against event revenue, so venues and cinemas have none.
  let principalMinor = 0, repaidMinor = 0, loanRows = 0;
  try {
    const { getOrganizerLoanFinance } = require("../services/loanRepaymentService");
    const Loan = require("../models/Loan");

    // loan_principal/loan_repayment represent a CUMULATIVE position that
    // grows over time (a second advance; more of an existing one repaid from
    // later ticket sales) — unlike a sale or withdrawal, there is no natural
    // per-event id to key an idempotent append off. Keying by organizer alone
    // (as this used to) meant the first backfill's figure froze forever: a
    // re-run found the key already claimed and skipped, even as the real
    // total kept growing. Found 2026-09-16 via the reconciler, alongside the
    // ticket-invalidation correction above — one organizer's ledger balance
    // was inflated by the full 103,120 ETB gap this alone was hiding. Writes
    // only the delta since last time, keyed by the new cumulative total, so
    // the key changes whenever the truth does and a no-op re-run (nothing
    // has changed) correctly writes nothing.
    const writeLoanDelta = async ({ owner, kind, currentTotalMinor, note }) => {
      const [existing] = await LedgerEntry.aggregate([
        {
          $match: {
            "owner.kind": owner.kind,
            "owner.id": owner.id,
            stream: "tickets",
            currency: CURRENCY,
            kind,
          },
        },
        { $group: { _id: null, total: { $sum: "$amountMinor" } } },
      ]);
      const recordedMinor = Math.abs(existing?.total || 0);
      const delta = currentTotalMinor - recordedMinor;
      if (delta <= 0) return;

      await ledger.append({
        owner, currency: CURRENCY, stream: "tickets",
        kind, amountMinor: delta,
        source: { note },
        idempotencyKey: `${kind}:${owner.id}:${CURRENCY}:upto:${currentTotalMinor}`,
      });
    };

    const borrowers = await Loan.distinct("organizer", {
      ...currencyMatch(CURRENCY),
      status: { $in: ["active", "repaid"] },
    });

    for (const organizerId of borrowers) {
      const finance = await getOrganizerLoanFinance(organizerId, CURRENCY);
      const owner = { kind: "organizer", id: organizerId };
      loanRows += 1;

      const principal = toMinor(finance.principalCredited || 0);
      if (principal > 0) {
        principalMinor += principal;
        if (WRITE) {
          await writeLoanDelta({
            owner, kind: "loan_principal", currentTotalMinor: principal,
            note: "backfill: capital principal",
          });
        }
      }

      const repaid = toMinor(finance.totalRepaidFromTickets || 0);
      if (repaid > 0) {
        repaidMinor += repaid;
        if (WRITE) {
          await writeLoanDelta({
            owner, kind: "loan_repayment", currentTotalMinor: repaid,
            note: "backfill: capital repayment",
          });
        }
      }
    }
  } catch (error) {
    console.log(`  Pazimo Capital: skipped (${error.message})`);
  }

  // --- Report --------------------------------------------------------------
  console.log("\n" + "=".repeat(72));
  console.log("RECONCILIATION".padEnd(72));
  console.log("=".repeat(72));

  const col = (n) => formatMinor(n, CURRENCY).padStart(18);
  console.log(
    "Channel".padEnd(22) + "Rows".padStart(8) + "Gross".padStart(18) + "Owner net".padStart(18)
  );
  console.log("-".repeat(72));
  for (const c of perChannel) {
    console.log(
      c.label.padEnd(22) + String(c.rows).padStart(8) + col(c.gross) + col(c.net)
    );
  }
  console.log("-".repeat(72));
  console.log("TOTAL".padEnd(22) + String(totals.rows).padStart(8) + col(totals.gross) + col(totals.net));

  console.log("\nPazimo's side");
  console.log("  Commission            " + col(totals.commission));
  console.log("  VAT on commission     " + col(totals.vat));
  console.log("  ---");
  console.log("  Pazimo equity         " + col(totals.commission));
  console.log("\nWithheld for government (a liability, never Pazimo revenue)");
  console.log("  Owner VAT             " + col(totals.ownerVat));

  console.log("\nPazimo Capital (ticket pool only)");
  console.log("  Principal credited    " + col(principalMinor));
  console.log("  Repaid from tickets   " + col(repaidMinor));
  console.log("  Borrowers             " + String(loanRows).padStart(18));

  console.log("\nPayouts");
  console.log("  Paid / approved       " + col(withdrawnMinor));
  console.log("  Pending               " + col(pendingMinor));
  console.log("  Rows                  " + String(payoutRows).padStart(18));

  console.log("\nCorrections (sales reversed — source row no longer valid revenue)");
  console.log("  Reversed              " + col(-Math.abs(correctionMinor)));
  console.log("  Rows                  " + String(correctionRows).padStart(18));

  // The identity that must hold for the books to be coherent.
  const identity = totals.commission + totals.vat + totals.ownerVat + totals.net;
  console.log("\nIntegrity");
  console.log(`  commission + vat + ownerVat + net === gross : ${identity === totals.gross ? "PASS" : "FAIL"}`);
  if (identity !== totals.gross) {
    console.log(`    off by ${formatMinor(identity - totals.gross, CURRENCY)}`);
  }
  console.log(`  rows skipped (no owner / zero amount)       : ${totals.skipped + payoutSkipped}`);

  // REBUILD_PLAN's gate.
  const TARGET = 67252923; // 672,529.23 in minor units
  if (CURRENCY === "ETB") {
    const delta = totals.commission - TARGET;
    console.log("\nREBUILD_PLAN gate (production only)");
    console.log(`  target Pazimo equity  ${formatMinor(TARGET, "ETB")}`);
    console.log(`  computed              ${formatMinor(totals.commission, "ETB")}`);
    console.log(`  difference            ${formatMinor(delta, "ETB")}`);
    console.log(
      delta === 0
        ? "  -> RECONCILES EXACTLY"
        : "  -> does not match (expected on any database that is not production)"
    );
  }

  console.log("\n" + (WRITE ? "Entries written." : "Dry run — nothing written. Re-run with --write to apply."));
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
