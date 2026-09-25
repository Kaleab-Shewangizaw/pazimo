// A batched, bulk-write replacement for backfillLedger.js's sales/withdrawal
// sections, built 2026-09-26 after the sequential version proved impractical
// on production's real ticket volume (11,674+ tickets, one row at a time —
// each row several sequential awaited round-trips — projected to run for
// hours and never actually finished in an overnight window).
//
// WHY THIS IS FAST WHERE THE OTHER ONE ISN'T
//
// backfillLedger.js calls ledger.append() per constituent movement, and each
// append() does an idempotency findOne, a create, a projection findOne, a
// projection findOneAndUpdate, and a save — five round-trips, one row at a
// time, awaited in sequence. This script instead:
//   1. Builds LedgerEntry documents in memory and inserts them in batches of
//      ~2000 via insertMany({ordered: false}) — the unique idempotencyKey
//      index does the duplicate-skipping (a batch that's part-new, part-
//      already-recorded still lands the new ones; write errors for the
//      duplicates are caught and counted, not treated as failure).
//   2. Never touches LedgerBalance incrementally. Once entries are in, it
//      calls the existing rebuildBalance() ONCE per (owner, stream) touched —
//      already an aggregation over just that owner's own entries, which is
//      what backfillLedger.js's original design was trying to avoid doing
//      per-row and is exactly right to do once per owner instead.
//
// WHAT THIS DELIBERATELY DOES NOT COVER
//
//   - The "Corrections" pass (reversing a sale whose source ticket later
//     became invalid). Every real backfill run so far has reported 0
//     reversals needed; add it here if that ever changes.
//   - Pazimo Capital's loan_principal — already handled, fast, by
//     backfillCapitalOnly.js. Don't duplicate it here.
//   - Loan repayment. There is no ledger write path for it at all (kind
//     "loan_repayment" is defined in the schema but nothing ever writes it) —
//     Loan.totalRepaid/outstandingBalance are the only authoritative record.
//     This means any organizer with loan history will read HIGHER on the
//     ledger than financeService.calculateOrganizerBalance by exactly their
//     totalRepaidFromTickets, because the ledger has no way to know that cut
//     happened. Known, separate, out of scope for this script.
//
//   node fastBackfillLedger.js              # report only
//   node fastBackfillLedger.js --write      # apply

const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const { toMinor, splitSale, formatMinor } = require("../utils/money");
const { DEFAULT_COMMISSION_RATE } = require("../config/rates");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CURRENCY = args.includes("--usd") ? "USD" : "ETB";
const BATCH_SIZE = 2000;

const currencyMatch = (currency) =>
  currency === "USD"
    ? { currency: "USD" }
    : { $or: [{ currency: "ETB" }, { currency: { $exists: false } }, { currency: null }] };

// Same shape as backfillLedger.js's SOURCES — kept identical on purpose so
// the two scripts can never quietly disagree about what counts as revenue.
const SOURCES = [
  {
    label: "Event tickets", model: "Ticket", stream: "tickets", ownerKind: "organizer",
    resolveOwner: async (row, ctx) => ctx.organizerByEvent.get(String(row.event)),
    grossOf: (row) => row.price,
    commissionRateOf: (row) => row.commissionRate ?? DEFAULT_COMMISSION_RATE,
    vatRateOf: (row) => row.vatRate ?? 0,
    ownerVatRateOf: (row) => row.organizerVatRate ?? 0,
    sourceRef: (row) => ({ ticket: row._id }),
    reference: (row) => `ticket:${row._id}`,
    select: "event price commissionRate vatRate organizerVatRate purchaseDate createdAt",
    occurredAt: (row) => row.purchaseDate || row.createdAt,
  },
  {
    label: "Event beverages", model: "BeverageSale", stream: "beverages", ownerKind: "organizer",
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
    label: "Venue beverages", model: "VenueBeverageSale", stream: "beverages", ownerKind: "venue",
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
    label: "Cinema tickets", model: "CinemaTicket", stream: "tickets", ownerKind: "cinema",
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
    label: "Cinema concessions", model: "CinemaBeverageSale", stream: "beverages", ownerKind: "cinema",
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

const revenueFilter = (model, currency) => {
  if (model === "Ticket") return require("../utils/ticketRevenueQuery").validTicketMatch(currency);
  if (model === "CinemaTicket") return require("../utils/cinemaTicketRevenueQuery").validCinemaTicketMatch(currency);
  return require("../utils/beverageRevenueQuery").validBeverageSaleMatch(currency);
};

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`\nConnected to ${mongoose.connection.name}`);
  console.log(`Currency: ${CURRENCY}   Mode: ${WRITE ? "WRITE" : "DRY RUN (no writes)"}   Batch: ${BATCH_SIZE}\n`);

  const LedgerEntry = require("../models/LedgerEntry");
  const Withdrawal = require("../models/Withdrawal");
  const Event = require("../models/Event");
  const { rebuildBalance } = require("../services/ledgerService");

  const events = await Event.find({}).select("_id organizer").lean();
  const organizerByEvent = new Map(events.map((e) => [String(e._id), e.organizer]));
  console.log(`Resolved ${events.length} events for organizer lookup\n`);

  // owner key -> {kind, id, stream}, for the rebuild pass at the end.
  // Keyed by a STRING (for Map dedup), but the stored value keeps the
  // ORIGINAL ObjectId — rebuildBalance's aggregate $match does not go
  // through Mongoose's query-casting layer, so a stringified id silently
  // matches zero documents there and rebuilds an owner's projection to all
  // zeros instead of leaving it alone. Caught locally before this ever
  // touched production; see the comment at the rebuild loop below.
  const touched = new Map();
  const touch = (kind, id, stream) => {
    const key = `${kind}:${id ? String(id) : ""}:${stream}`;
    if (!touched.has(key)) touched.set(key, { kind, id, stream });
  };

  let attempted = 0, inserted = 0, duplicates = 0, otherErrors = 0;
  const perChannel = [];

  const flush = async (batch) => {
    if (batch.length === 0) return;
    attempted += batch.length;
    if (!WRITE) return;
    try {
      const res = await LedgerEntry.insertMany(batch, { ordered: false });
      inserted += res.length;
    } catch (err) {
      // MongoBulkWriteError: some succeeded, some are duplicate-key (11000).
      const insertedCount = err.insertedDocs?.length ?? err.result?.insertedCount ?? 0;
      inserted += insertedCount;
      const writeErrors = err.writeErrors || [];
      const dup = writeErrors.filter((e) => e.code === 11000 || e.err?.code === 11000);
      const real = writeErrors.filter((e) => e.code !== 11000 && e.err?.code !== 11000);
      duplicates += dup.length;
      if (real.length > 0) {
        otherErrors += real.length;
        console.error(`  ${real.length} non-duplicate write error(s), e.g.:`, real[0].errmsg || real[0]);
      }
      // Anything not accounted for by insertedCount/dup/real is unexpected —
      // surface it as an error count rather than silently dropping it.
      const unaccounted = batch.length - insertedCount - dup.length - real.length;
      if (unaccounted > 0) otherErrors += unaccounted;
    }
  };

  for (const src of SOURCES) {
    let Model;
    try {
      Model = require(`../models/${src.model}`);
    } catch {
      console.log(`  ${src.label}: model not present, skipping`);
      continue;
    }

    const filter = revenueFilter(src.model, CURRENCY);
    const rows = Model.find(filter)
      .select(src.select)
      .lean()
      .cursor()
      .addCursorFlag("noCursorTimeout", true);

    const channel = { label: src.label, rows: 0, skipped: 0, entries: 0 };
    let batch = [];

    for await (const row of rows) {
      const ownerId = await src.resolveOwner(row, { organizerByEvent });
      if (!ownerId) { channel.skipped += 1; continue; }

      const grossMinor = toMinor(src.grossOf(row) || 0);
      if (grossMinor <= 0) { channel.skipped += 1; continue; }

      const split = splitSale({
        grossMinor,
        commissionRate: src.commissionRateOf(row),
        vatRate: src.vatRateOf(row),
        ownerVatRate: src.ownerVatRateOf(row),
      });

      const saleKind = src.stream === "beverages" ? "beverage_sale" : "ticket_sale";
      const owner = { kind: src.ownerKind, id: ownerId };
      const occurredAt = src.occurredAt(row);
      const reference = src.reference(row);
      const sourceRef = src.sourceRef(row);

      channel.rows += 1;
      touch(src.ownerKind, ownerId, src.stream);

      // Credit: the sale itself. Sign matches ledgerService's CREDIT_KINDS —
      // ticket_sale/beverage_sale are positive, everything below is negative.
      batch.push({
        owner, currency: CURRENCY, stream: src.stream, kind: saleKind,
        amountMinor: split.grossMinor,
        source: { ...sourceRef, note: "fast-backfill" },
        idempotencyKey: `${saleKind}:${reference}`,
        occurredAt,
      });
      channel.entries += 1;

      if (split.commissionMinor !== 0) {
        // Debit: commission taken from the seller.
        batch.push({
          owner, currency: CURRENCY, stream: src.stream, kind: "commission",
          amountMinor: -split.commissionMinor,
          source: { ...sourceRef, note: "fast-backfill" },
          idempotencyKey: `commission:${reference}`,
          occurredAt,
        });
        // Credit: mirrored onto Pazimo's own books. recordSale always uses
        // kind "ticket_sale" here regardless of the source stream — matched
        // exactly, since future incremental writes do the same and the two
        // must never diverge on this.
        touch("platform", "", src.stream);
        batch.push({
          owner: { kind: "platform" }, currency: CURRENCY, stream: src.stream, kind: "ticket_sale",
          amountMinor: split.commissionMinor,
          source: { ...sourceRef, note: "fast-backfill" },
          idempotencyKey: `platform_commission:${reference}`,
          occurredAt,
        });
        channel.entries += 2;
      }

      if (split.vatMinor !== 0) {
        batch.push({
          owner, currency: CURRENCY, stream: src.stream, kind: "vat",
          amountMinor: -split.vatMinor,
          source: { ...sourceRef, note: "fast-backfill" },
          idempotencyKey: `vat:${reference}`,
          occurredAt,
        });
        channel.entries += 1;
      }

      if (split.ownerVatMinor !== 0) {
        batch.push({
          owner, currency: CURRENCY, stream: src.stream, kind: "owner_vat",
          amountMinor: -split.ownerVatMinor,
          source: { ...sourceRef, note: "fast-backfill" },
          idempotencyKey: `owner_vat:${reference}`,
          occurredAt,
        });
        channel.entries += 1;
      }

      if (batch.length >= BATCH_SIZE) {
        await flush(batch);
        batch = [];
      }
    }
    await flush(batch);

    perChannel.push(channel);
    console.log(`  ${src.label}: ${channel.rows} rows, ${channel.skipped} skipped, ${channel.entries} entries attempted`);
  }

  // --- Withdrawals, same bulk approach --------------------------------
  const STREAM_OF = { tickets: "tickets", beverages: "beverages", venue_beverages: "beverages", cinema_tickets: "tickets", cinema_beverages: "beverages" };
  const OWNER_OF = { tickets: "organizer", beverages: "organizer", venue_beverages: "venue", cinema_tickets: "cinema", cinema_beverages: "cinema" };

  const payouts = await Withdrawal.find({
    ...currencyMatch(CURRENCY),
    status: { $in: ["pending", "approved", "completed"] },
    // Capital handled separately by backfillCapitalOnly.js — never here.
    stream: { $ne: "capital" },
  }).lean();

  let wdBatch = [];
  let wdRows = 0, wdSkipped = 0;
  for (const w of payouts) {
    const stream = STREAM_OF[w.stream || "tickets"];
    const ownerKind = OWNER_OF[w.stream || "tickets"];
    const ownerId = ownerKind === "venue" ? w.venue : ownerKind === "cinema" ? w.cinema : w.organizer;
    if (!ownerId) { wdSkipped += 1; continue; }

    const amountMinor = toMinor(w.amount || 0);
    if (amountMinor <= 0) { wdSkipped += 1; continue; }

    wdRows += 1;
    touch(ownerKind, ownerId, stream);
    wdBatch.push({
      owner: { kind: ownerKind, id: ownerId }, currency: CURRENCY, stream, kind: "withdrawal",
      amountMinor: -amountMinor,
      source: { withdrawal: w._id, note: "fast-backfill" },
      idempotencyKey: `withdrawal:${w._id}`,
      occurredAt: w.processedAt || w.createdAt,
    });
    if (wdBatch.length >= BATCH_SIZE) { await flush(wdBatch); wdBatch = []; }
  }
  await flush(wdBatch);
  console.log(`  Withdrawals: ${wdRows} rows, ${wdSkipped} skipped`);

  console.log(`\nEntries attempted: ${attempted}   inserted: ${inserted}   already existed: ${duplicates}   errors: ${otherErrors}`);
  if (otherErrors > 0) {
    console.log("\nNON-DUPLICATE ERRORS OCCURRED — investigate before trusting the rebuild below.");
  }

  // --- Rebuild every touched projection, once each --------------------
  console.log(`\nRebuilding ${touched.size} projection(s)...`);
  let rebuilt = 0;
  if (WRITE) {
    for (const { kind, id, stream } of touched.values()) {
      const owner = kind === "platform" ? { kind: "platform" } : { kind, id };
      await rebuildBalance({ owner, currency: CURRENCY, stream });
      rebuilt += 1;
      if (rebuilt % 20 === 0) console.log(`  ...${rebuilt}/${touched.size}`);
    }
  }
  console.log(WRITE ? `Rebuilt ${rebuilt} projection(s).` : "Dry run — nothing written, nothing rebuilt. Re-run with --write to apply.");
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
