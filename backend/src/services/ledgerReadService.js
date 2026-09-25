const LedgerBalance = require("../models/LedgerBalance");
const LedgerEntry = require("../models/LedgerEntry");
const { toMajor } = require("../utils/money");

// The fast read path.
//
// Every figure here is one indexed document lookup. The formulas it replaces
// scan an owner's entire sales history and re-derive commission and VAT per
// row on every request — which is why a balance is slow today and gets slower
// with every ticket sold.
//
// CUTOVER STATUS. Phase 3 gates the full switch on the reconciler agreeing for
// the whole dual-write period, and the OWNER-facing reads — an organizer's
// finance page, the withdrawal check — are still on the old formulas until then.
//
// One read has already moved: getPlatformPartitions, the admin dashboard's
// money cards. It moved early and deliberately, because the figure it replaced
// was not merely slow but wrong (see the comment on that function), and because
// it is a read-only admin report — nobody is paid out on the strength of it. It
// carries a coverage guard so an unbackfilled ledger reports itself instead of
// answering 0.00.

/** A projection document as the shape the existing screens already expect. */
const asMajor = (doc) => ({
  currency: doc.currency,
  stream: doc.stream,
  grossRevenue: toMajor(doc.grossMinor),
  pazimoCommission: toMajor(doc.commissionMinor),
  vatOnCommission: toMajor(doc.vatMinor),
  ownerVat: toMajor(doc.ownerVatMinor),
  // gross - commission - vat - ownerVat, NOT netMinor. This used to matter
  // for the "tickets" stream specifically because Pazimo Capital's
  // loan_principal/loan_repayment used to be written onto that same stream,
  // so netMinor carried loan cash flow that grossMinor didn't — a ~23,000
  // ETB gap found 2026-09-17 between this figure and the dashboard's
  // ticket-only organizerRevenue on an otherwise fully reconciled ledger.
  // Capital now has its own "capital" stream (see ledgerService's
  // PROJECTION_FIELD and Withdrawal/LedgerEntry/LedgerBalance's stream
  // enums), so "tickets" no longer carries any loan movement at all — this
  // formula is kept anyway because gross/net should agree by construction on
  // every stream, and computing it this way is what would catch it if they
  // ever didn't.
  ownerRevenue: toMajor(
    doc.grossMinor - doc.commissionMinor - doc.vatMinor - doc.ownerVatMinor
  ),
  withdrawn: toMajor(doc.withdrawnMinor),
  pendingWithdrawals: toMajor(doc.pendingMinor),
  availableBalance: toMajor(doc.availableMinor),
  entryCount: doc.entryCount,
  lastEntryAt: doc.lastEntryAt,
});

const EMPTY = (currency, stream) => ({
  currency, stream,
  grossRevenue: 0, pazimoCommission: 0, vatOnCommission: 0, ownerVat: 0,
  ownerRevenue: 0, withdrawn: 0, pendingWithdrawals: 0, availableBalance: 0,
  entryCount: 0, lastEntryAt: null,
});

/**
 * One owner's balance, both pools, in a single query.
 *
 * O(1) in the number of sales — which is the whole point.
 */
const getOwnerBalance = async (owner, currency = "ETB") => {
  const docs = await LedgerBalance.find({
    "owner.kind": owner.kind,
    ...(owner.kind === "platform" ? {} : { "owner.id": owner.id }),
    currency,
  }).lean();

  const byStream = new Map(docs.map((d) => [d.stream, asMajor(d)]));
  const tickets = byStream.get("tickets") || EMPTY(currency, "tickets");
  const beverages = byStream.get("beverages") || EMPTY(currency, "beverages");

  return {
    currency,
    streams: { tickets, beverages },
    combined: {
      grossRevenue: tickets.grossRevenue + beverages.grossRevenue,
      ownerRevenue: tickets.ownerRevenue + beverages.ownerRevenue,
      pazimoCommission: tickets.pazimoCommission + beverages.pazimoCommission,
      vatOnCommission: tickets.vatOnCommission + beverages.vatOnCommission,
      ownerVat: tickets.ownerVat + beverages.ownerVat,
      // Display only. A withdrawal must always validate against ONE pool —
      // summing them is what would let seat money fund a concession payout.
      availableBalance: tickets.availableBalance + beverages.availableBalance,
    },
  };
};

/**
 * Pazimo's own position — the admin's running totals.
 *
 * This is the figure that used to require summing every ticket on the platform.
 * It is now the same single-document read as anyone else's, because commission
 * is mirrored onto a "platform" owner as it is charged.
 */
const getPlatformTotals = (currency = "ETB") =>
  getOwnerBalance({ kind: "platform" }, currency);

/**
 * Every seller's position, for the admin overview.
 *
 * One indexed query for the whole list, instead of one balance computation per
 * seller — the shape getAdminCinemaFinance currently uses and which does not
 * survive more than a few dozen sellers.
 */
const listBalances = async ({ ownerKind, currency = "ETB", limit = 200 } = {}) => {
  const filter = { currency };
  if (ownerKind) filter["owner.kind"] = ownerKind;
  return LedgerBalance.find(filter)
    .sort({ availableMinor: -1 })
    .limit(limit)
    .lean();
};

/**
 * One owner's statement — the movements behind the number.
 *
 * Paged, newest first, straight off the { owner, currency, stream, occurredAt }
 * index. This is the view that is impossible today: there is currently no
 * record of WHY a balance is what it is.
 */
const getStatement = async (
  owner,
  { currency = "ETB", stream, limit = 50, before } = {}
) => {
  const filter = {
    "owner.kind": owner.kind,
    ...(owner.kind === "platform" ? {} : { "owner.id": owner.id }),
    currency,
  };
  if (stream) filter.stream = stream;
  if (before) filter.occurredAt = { $lt: new Date(before) };

  const entries = await LedgerEntry.find(filter)
    .sort({ occurredAt: -1, _id: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();

  return entries.map((e) => ({
    _id: e._id,
    kind: e.kind,
    stream: e.stream,
    amount: toMajor(e.amountMinor),
    balanceAfter:
      e.balanceAfterMinor === undefined || e.balanceAfterMinor === null
        ? null
        : toMajor(e.balanceAfterMinor),
    source: e.source,
    occurredAt: e.occurredAt,
  }));
};

/**
 * The five money partitions, for the admin dashboard.
 *
 * WHY THIS EXISTS
 *
 * The admin dashboard used to show ONE "available balance", computed as
 * organizer TICKET revenue minus withdrawals across EVERY stream. Beverage,
 * venue and cinema payouts were all subtracted from ticket revenue, so the
 * number went negative as soon as anyone withdrew drink money — which is what
 * it was showing on the local database: 273.13 - 1,500.00 - 120.00 = -1,346.87.
 *
 * That is the exact failure PAZIMO_PLAN decision 1 names: "one channel's money
 * summed into another's by an aggregation that forgot a filter". The fix is not
 * to add the filter to that one query, it is to stop having a single global
 * number at all. Money is settled per pool, so it is reported per pool.
 *
 * WHY IT READS THE LEDGER
 *
 * One indexed aggregation over LedgerBalance, which holds one document per
 * (owner, currency, stream) — tens of documents today, thousands at a million
 * tickets a year. The alternative is five aggregations that each scan a whole
 * sales collection and re-derive commission and VAT per row, and those grow
 * with every ticket sold. The partition the cards need — owner kind crossed
 * with stream — is already the ledger's natural key, so this is one $group with
 * no lookups.
 */

// The five pools, in display order. Named here rather than derived from the
// data so a partition with no sales yet still renders as a zeroed card instead
// of vanishing — an empty cinema is information, a missing card is a bug.
const PARTITIONS = [
  { key: "event_tickets", label: "Event tickets", ownerKind: "organizer", stream: "tickets" },
  { key: "event_beverages", label: "Event beverages", ownerKind: "organizer", stream: "beverages" },
  { key: "venue_beverages", label: "Venue beverages", ownerKind: "venue", stream: "beverages" },
  { key: "cinema_tickets", label: "Cinema tickets", ownerKind: "cinema", stream: "tickets" },
  { key: "cinema_beverages", label: "Cinema concessions", ownerKind: "cinema", stream: "beverages" },
  // A loan's principal, and nothing else — never mixed with event_tickets.
  { key: "capital", label: "Pazimo Capital", ownerKind: "organizer", stream: "capital" },
];

const emptyPartition = (partition, currency) => ({
  ...partition,
  currency,
  grossRevenue: 0,
  ownerRevenue: 0,
  pazimoCommission: 0,
  vatOnCommission: 0,
  ownerVat: 0,
  withdrawn: 0,
  pendingWithdrawals: 0,
  availableBalance: 0,
  ownerCount: 0,
  entryCount: 0,
  lastEntryAt: null,
});

/**
 * Whether the ledger can be trusted to answer at all.
 *
 * Without this the dashboard has a failure mode worse than being wrong: if the
 * backfill has not been run, every figure reads a confident 0.00 and looks like
 * a platform that has never sold anything. Reporting coverage as fact turns a
 * silent zero into a visible "not backfilled".
 *
 * Uses estimatedDocumentCount, which reads collection metadata rather than
 * counting rows, so the guard costs effectively nothing.
 */
// The collections the ledger is built from. Named rather than derived so a
// channel added later shows up as missing coverage instead of quietly not being
// checked. A collection that does not exist yet counts 0 rather than throwing,
// which is why this needs no listCollections call — that call cost more than
// every count here put together.
const SOURCE_COLLECTIONS = [
  "tickets",
  "beveragesales",
  "venuebeveragesales",
  "cinematickets",
  "cinemabeveragesales",
];

const getLedgerCoverage = async () => {
  const { connection } = require("mongoose");

  const [sourceCounts, ledgerEntries, [newest]] = await Promise.all([
    Promise.all(
      SOURCE_COLLECTIONS.map(async (name) => ({
        name,
        rows: await connection.db.collection(name).estimatedDocumentCount(),
      }))
    ),
    LedgerEntry.estimatedDocumentCount(),
    LedgerEntry.find({}).sort({ occurredAt: -1 }).limit(1).select("occurredAt").lean(),
  ]);

  const sourceRows = sourceCounts.reduce((sum, c) => sum + c.rows, 0);

  return {
    // The one unambiguous failure: money exists in the source collections and
    // the ledger has nothing at all. Everything else is a judgement call the
    // caller can make from the numbers below.
    backfilled: !(sourceRows > 0 && ledgerEntries === 0),
    sourceRows,
    ledgerEntries,
    lastEntryAt: newest?.occurredAt ?? null,
    bySource: sourceCounts,
  };
};

/**
 * Every partition's position, in one aggregation.
 *
 * `withCoverage: false` skips the coverage probe for callers that already know
 * the ledger is populated — the probe is cheap but not free.
 */
const getPlatformPartitions = async (currency = "ETB", { withCoverage = true } = {}) => {
  const [rows, coverage] = await Promise.all([
    LedgerBalance.aggregate([
      { $match: { currency } },
      {
        $group: {
          _id: { ownerKind: "$owner.kind", stream: "$stream" },
          grossMinor: { $sum: "$grossMinor" },
          commissionMinor: { $sum: "$commissionMinor" },
          vatMinor: { $sum: "$vatMinor" },
          ownerVatMinor: { $sum: "$ownerVatMinor" },
          netMinor: { $sum: "$netMinor" },
          withdrawnMinor: { $sum: "$withdrawnMinor" },
          pendingMinor: { $sum: "$pendingMinor" },
          // Floored per OWNER before summing, not after. A negative
          // availableMinor is a real, already-tracked accounting problem on
          // one seller's account (see pazimo-negative-organizer-balance
          // memory) — useful to see on THAT seller's own row, but it must
          // never bleed into the platform-wide total and make it look like
          // there's less real, withdrawable money across everyone else than
          // there actually is. Same principle financeService.
          // calculateOrganizerBalance and organizerOverviewController
          // already apply per-organizer; this is the same fix at the
          // platform-aggregate level.
          availableMinor: { $sum: { $max: ["$availableMinor", 0] } },
          // How many distinct sellers actually hold a position in this pool —
          // the number that makes "1,247.52 available" mean something.
          //
          // Counts only owners with at least one entry. A projection row can
          // exist with entryCount 0 (created, then every entry reversed or
          // removed), and counting those would report sellers into a pool that
          // has never seen a transaction.
          ownerCount: { $sum: { $cond: [{ $gt: ["$entryCount", 0] }, 1, 0] } },
          entryCount: { $sum: "$entryCount" },
          lastEntryAt: { $max: "$lastEntryAt" },
        },
      },
    ]),
    withCoverage ? getLedgerCoverage() : Promise.resolve(null),
  ]);

  const byKey = new Map(
    rows.map((r) => [`${r._id.ownerKind}:${r._id.stream}`, r])
  );

  const partitions = PARTITIONS.map((partition) => {
    const row = byKey.get(`${partition.ownerKind}:${partition.stream}`);
    if (!row) return emptyPartition(partition, currency);
    return {
      ...partition,
      currency,
      grossRevenue: toMajor(row.grossMinor),
      // Not netMinor — see asMajor's comment above; same fix, same reason.
      ownerRevenue: toMajor(
        row.grossMinor - row.commissionMinor - row.vatMinor - row.ownerVatMinor
      ),
      pazimoCommission: toMajor(row.commissionMinor),
      vatOnCommission: toMajor(row.vatMinor),
      ownerVat: toMajor(row.ownerVatMinor),
      withdrawn: toMajor(row.withdrawnMinor),
      pendingWithdrawals: toMajor(row.pendingMinor),
      availableBalance: toMajor(row.availableMinor),
      ownerCount: row.ownerCount,
      entryCount: row.entryCount,
      lastEntryAt: row.lastEntryAt ?? null,
    };
  });

  // Pazimo's own position, from the same aggregation. Commission is mirrored
  // onto a "platform" owner as it is charged, so what the platform earned is
  // the same cheap read as what anyone else is owed — never a sum over tickets.
  const platformRows = rows.filter((r) => r._id.ownerKind === "platform");
  const platform = {
    currency,
    // Pazimo's actual earnings: commission plus the VAT charged on it.
    // ownerVat is excluded on purpose — it is withheld for the government and
    // remitted, never revenue, and every figure that says "earned" must exclude
    // it. See config/rates.js.
    commission: toMajor(platformRows.reduce((sum, r) => sum + r.grossMinor, 0)),
    byStream: Object.fromEntries(
      platformRows.map((r) => [r._id.stream, toMajor(r.grossMinor)])
    ),
    // Per-stream figures above are each converted from their own integer, so
    // they never drift; the total is summed in minor units for the same reason.
  };

  // Sums across pools, for a header line. Display only: a withdrawal is always
  // validated against ONE pool, because summing them is precisely what would
  // let seat money fund a concession payout.
  //
  // Accumulated in MINOR UNITS and converted once at the end, not by adding the
  // already-converted majors. Summing majors reintroduces exactly the float
  // drift the integer money rule exists to prevent — 9.37 + 115.20 came out as
  // 124.57000000000001 and went to the client that way.
  const partitionKeys = new Set(PARTITIONS.map((p) => `${p.ownerKind}:${p.stream}`));
  const totalsMinor = rows
    .filter((r) => partitionKeys.has(`${r._id.ownerKind}:${r._id.stream}`))
    .reduce(
      (acc, r) => ({
        grossMinor: acc.grossMinor + r.grossMinor,
        netMinor: acc.netMinor + r.netMinor,
        commissionMinor: acc.commissionMinor + r.commissionMinor,
        vatMinor: acc.vatMinor + r.vatMinor,
        ownerVatMinor: acc.ownerVatMinor + r.ownerVatMinor,
        withdrawnMinor: acc.withdrawnMinor + r.withdrawnMinor,
        pendingMinor: acc.pendingMinor + r.pendingMinor,
        availableMinor: acc.availableMinor + r.availableMinor,
      }),
      {
        grossMinor: 0, netMinor: 0, commissionMinor: 0, vatMinor: 0,
        ownerVatMinor: 0, withdrawnMinor: 0, pendingMinor: 0, availableMinor: 0,
      }
    );

  const totals = {
    grossRevenue: toMajor(totalsMinor.grossMinor),
    // Not netMinor — see asMajor's comment above; same fix, same reason.
    ownerRevenue: toMajor(
      totalsMinor.grossMinor - totalsMinor.commissionMinor - totalsMinor.vatMinor - totalsMinor.ownerVatMinor
    ),
    pazimoCommission: toMajor(totalsMinor.commissionMinor),
    vatOnCommission: toMajor(totalsMinor.vatMinor),
    ownerVat: toMajor(totalsMinor.ownerVatMinor),
    withdrawn: toMajor(totalsMinor.withdrawnMinor),
    pendingWithdrawals: toMajor(totalsMinor.pendingMinor),
    availableBalance: toMajor(totalsMinor.availableMinor),
  };

  return { currency, partitions, platform, totals, coverage };
};

module.exports = {
  getOwnerBalance,
  getPlatformTotals,
  getPlatformPartitions,
  getLedgerCoverage,
  listBalances,
  getStatement,
  PARTITIONS,
};
