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
// NOT YET WIRED TO THE DASHBOARDS. REBUILD_PLAN Phase 3 gates that on the
// reconciler agreeing for the full dual-write period; until then this exists to
// be measured against the old path, and to be switched to in one place when the
// gate passes.

/** A projection document as the shape the existing screens already expect. */
const asMajor = (doc) => ({
  currency: doc.currency,
  stream: doc.stream,
  grossRevenue: toMajor(doc.grossMinor),
  pazimoCommission: toMajor(doc.commissionMinor),
  vatOnCommission: toMajor(doc.vatMinor),
  ownerVat: toMajor(doc.ownerVatMinor),
  ownerRevenue: toMajor(doc.netMinor),
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

module.exports = {
  getOwnerBalance,
  getPlatformTotals,
  listBalances,
  getStatement,
};
