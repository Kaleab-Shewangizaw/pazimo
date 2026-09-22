const mongoose = require("mongoose");
const LedgerEntry = require("../models/LedgerEntry");
const LedgerBalance = require("../models/LedgerBalance");
const { toMinor, splitSale } = require("../utils/money");
const { DEFAULT_COMMISSION_RATE } = require("../config/rates");

// The one place money is written.
//
// Everything else — a ticket sale, a drink sold at a counter, a payout, a
// refund — describes WHAT happened and calls in here. How that becomes entries,
// how the running total is maintained, and how a replay is made harmless all
// live here so there is one implementation to get right rather than one per
// caller. Four divergent balance formulas is what the alternative looked like.

const DUPLICATE_KEY = 11000;

/**
 * Which entry kinds move money toward the owner.
 *
 * Sign is decided here, once, rather than by each caller passing a signed
 * amount — a caller that gets the sign wrong writes a plausible-looking entry
 * that silently inverts a balance, and nothing downstream can detect it.
 */
const CREDIT_KINDS = new Set([
  "ticket_sale",
  "beverage_sale",
  "loan_principal",
  "withdrawal_reversal",
]);

/** How each kind folds into the projection's breakdown. */
const PROJECTION_FIELD = {
  ticket_sale: "grossMinor",
  beverage_sale: "grossMinor",
  // Capital's own stream has no commission/vat/ownerVat — a loan principal
  // is credited whole, not split. Folding it into grossMinor keeps that
  // stream's gross === net, the same identity the sale streams hold.
  loan_principal: "grossMinor",
  commission: "commissionMinor",
  vat: "vatMinor",
  owner_vat: "ownerVatMinor",
};

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

let transactionSupport;

/**
 * Whether this deployment can run a transaction.
 *
 * Production is Atlas (a replica set) and can; a developer's standalone mongod
 * cannot, and calling withTransaction there throws. Rather than force every
 * developer to run a replica set, the write path degrades: the entry is written
 * first and the projection second, so a crash between them leaves the ledger
 * correct and the projection stale — recoverable by rebuildBalance(), which is
 * exactly the failure mode a projection is allowed to have.
 *
 * The reverse order would not be recoverable, which is why it is never used.
 */
const supportsTransactions = async () => {
  if (transactionSupport !== undefined) return transactionSupport;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(info.setName) || info.msg === "isdbgrid";
  } catch {
    transactionSupport = false;
  }
  if (!transactionSupport) {
    console.warn(
      "[ledger] MongoDB is standalone — money writes are not transactional. " +
        "Entries stay correct; projections may need rebuildBalance() after a crash."
    );
  }
  return transactionSupport;
};

const withOptionalTransaction = async (fn) => {
  if (!(await supportsTransactions())) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

// ---------------------------------------------------------------------------
// Appending
// ---------------------------------------------------------------------------

const ownerFilter = (owner) => ({
  "owner.kind": owner.kind,
  ...(owner.kind === "platform" ? {} : { "owner.id": owner.id }),
});

/**
 * Fold one entry into an owner's projection and return the new position.
 *
 * The projection is read, adjusted and written under its version — so two
 * concurrent appends cannot both apply against the same starting figure. On a
 * replica set the surrounding transaction already guarantees that; the version
 * check is what preserves it on a standalone.
 */
const applyToProjection = async ({ owner, currency, stream, kind, amountMinor, entry, session }) => {
  const filter = { ...ownerFilter(owner), currency, stream };
  const opts = session ? { session } : {};

  // upsert so the first entry for an owner creates their projection.
  const current =
    (await LedgerBalance.findOne(filter, null, opts)) ||
    (await LedgerBalance.create(
      [{ owner, currency, stream }],
      session ? { session } : {}
    ).then((docs) => docs[0]));

  const inc = { netMinor: amountMinor, entryCount: 1, version: 1 };

  // Withdrawals are tracked apart from net so a payout never looks like a loss
  // of revenue — the money was earned, it has simply left.
  if (kind === "withdrawal") {
    inc.netMinor = 0;
    inc.withdrawnMinor = -amountMinor; // amountMinor is negative
  } else if (kind === "withdrawal_reversal") {
    inc.netMinor = 0;
    inc.withdrawnMinor = -amountMinor;
  } else {
    const field = PROJECTION_FIELD[kind];
    // Debits (commission, vat, owner_vat) are stored positive in the breakdown
    // but reduce net — the breakdown answers "how much was taken", the sign
    // answers "which way did it move".
    if (field && field !== "grossMinor") inc[field] = -amountMinor;
    else if (field) inc[field] = amountMinor;
  }

  const updated = await LedgerBalance.findOneAndUpdate(
    { _id: current._id, version: current.version },
    {
      $inc: inc,
      $set: { lastEntryId: entry._id, lastEntryAt: entry.occurredAt },
    },
    { new: true, ...opts }
  );

  if (!updated) {
    // Someone else advanced this projection between the read and the write.
    // The entry is already durable, so the safe resolution is to recompute
    // rather than guess — the caller retries or the reconciler picks it up.
    throw Object.assign(
      new Error("Ledger projection changed concurrently; retry"),
      { code: "LEDGER_CONFLICT" }
    );
  }

  updated.availableMinor =
    updated.netMinor - updated.withdrawnMinor - updated.pendingMinor;
  await updated.save(opts);

  return updated;
};

/**
 * Append one entry.
 *
 * Idempotent: an entry whose idempotencyKey already exists is a no-op that
 * returns the existing row, so a retried webhook, a re-run backfill or a
 * duplicated queue message cannot double-count.
 */
const append = async ({
  owner,
  currency = "ETB",
  stream,
  kind,
  amountMinor,
  source = {},
  idempotencyKey,
  occurredAt,
  session: outerSession,
}) => {
  if (!Number.isInteger(amountMinor)) {
    throw new TypeError(`amountMinor must be an integer, got ${amountMinor}`);
  }
  if (!idempotencyKey) throw new Error("idempotencyKey is required");

  // The caller passes a magnitude; direction is this module's decision.
  const signed = CREDIT_KINDS.has(kind)
    ? Math.abs(amountMinor)
    : -Math.abs(amountMinor);

  const run = async (session) => {
    const opts = session ? { session } : {};

    const existing = await LedgerEntry.findOne({ idempotencyKey }, null, opts);
    if (existing) return { entry: existing, duplicate: true };

    let entry;
    try {
      [entry] = await LedgerEntry.create(
        [
          {
            owner,
            currency,
            stream,
            kind,
            amountMinor: signed,
            source,
            idempotencyKey,
            occurredAt: occurredAt || new Date(),
          },
        ],
        session ? { session } : {}
      );
    } catch (error) {
      // Lost the race to an identical append; the unique index did its job.
      if (error?.code === DUPLICATE_KEY) {
        const winner = await LedgerEntry.findOne({ idempotencyKey }, null, opts);
        return { entry: winner, duplicate: true };
      }
      throw error;
    }

    const balance = await applyToProjection({
      owner,
      currency,
      stream,
      kind,
      amountMinor: signed,
      entry,
      session,
    });

    entry.balanceAfterMinor = balance.netMinor - balance.withdrawnMinor;
    await entry.save(opts);

    return { entry, balance, duplicate: false };
  };

  // A caller already inside a transaction passes its session in, so the whole
  // sale lands or none of it does.
  return outerSession ? run(outerSession) : withOptionalTransaction(run);
};

/**
 * Record a sale as its four constituent movements.
 *
 * One sale is not one entry. Recording it as gross, commission, VAT and
 * withheld owner-VAT separately is what makes "what did Pazimo earn this month"
 * a sum over kind rather than a re-derivation from every ticket at the rate it
 * was sold under — which is the thing that is slow today.
 *
 * The commission and VAT are also credited to the platform, so the admin's
 * totals are maintained by the same mechanism rather than by a second one.
 */
const recordSale = async ({
  owner,
  currency = "ETB",
  stream,
  grossAmount,
  commissionRate = DEFAULT_COMMISSION_RATE,
  // The government VAT-on-commission rate this specific sale was made
  // under. Defaults to 0, NOT the live VAT_RATE constant — a caller with a
  // per-sale snapshot (Ticket.vatRate and its four siblings) must pass it
  // explicitly; a caller with none is a sale from before the snapshot field
  // existed, and 0 is what was actually true then. Using the live constant
  // here would restate old sales the moment VAT_RATE next changes — the
  // exact mix-up this parameter exists to prevent.
  vatRate = 0,
  ownerVatRate = 0,
  source = {},
  reference,
  occurredAt,
  session,
}) => {
  if (!reference) throw new Error("reference is required to key a sale");

  const split = splitSale({
    grossMinor: toMinor(grossAmount),
    commissionRate,
    vatRate,
    ownerVatRate,
  });

  const saleKind = stream === "beverages" ? "beverage_sale" : "ticket_sale";
  const common = { owner, currency, stream, source, occurredAt, session };
  const platform = { kind: "platform" };

  const results = [];
  results.push(
    await append({
      ...common,
      kind: saleKind,
      amountMinor: split.grossMinor,
      idempotencyKey: `${saleKind}:${reference}`,
    })
  );

  if (split.commissionMinor !== 0) {
    results.push(
      await append({
        ...common,
        kind: "commission",
        amountMinor: split.commissionMinor,
        idempotencyKey: `commission:${reference}`,
      })
    );
    // Mirror onto Pazimo's own books.
    results.push(
      await append({
        ...common,
        owner: platform,
        kind: "ticket_sale",
        amountMinor: split.commissionMinor,
        idempotencyKey: `platform_commission:${reference}`,
      })
    );
  }

  if (split.vatMinor !== 0) {
    results.push(
      await append({
        ...common,
        kind: "vat",
        amountMinor: split.vatMinor,
        idempotencyKey: `vat:${reference}`,
      })
    );
  }

  if (split.ownerVatMinor !== 0) {
    results.push(
      await append({
        ...common,
        kind: "owner_vat",
        amountMinor: split.ownerVatMinor,
        idempotencyKey: `owner_vat:${reference}`,
      })
    );
  }

  return { split, entries: results.map((r) => r.entry) };
};

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** One owner's pool, as a single indexed document read. */
const getBalance = async (owner, { currency = "ETB", stream } = {}) => {
  const filter = { ...ownerFilter(owner), currency };
  if (stream) filter.stream = stream;
  return LedgerBalance.find(filter).lean();
};

/**
 * Rebuild a projection from the entries.
 *
 * The recovery path, and the reconciler's comparison basis. Because entries are
 * the truth, this is always safe to run: it can correct a drifted projection
 * and can never corrupt the ledger.
 */
const rebuildBalance = async ({ owner, currency = "ETB", stream }) => {
  const match = { ...ownerFilter(owner), currency, stream };

  const [totals] = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        entryCount: { $sum: 1 },
        netMinor: {
          $sum: {
            $cond: [
              { $in: ["$kind", ["withdrawal", "withdrawal_reversal"]] },
              0,
              "$amountMinor",
            ],
          },
        },
        withdrawnMinor: {
          $sum: {
            $cond: [
              { $in: ["$kind", ["withdrawal", "withdrawal_reversal"]] },
              { $multiply: ["$amountMinor", -1] },
              0,
            ],
          },
        },
        grossMinor: {
          $sum: {
            $cond: [
              { $in: ["$kind", ["ticket_sale", "beverage_sale", "loan_principal"]] },
              "$amountMinor",
              0,
            ],
          },
        },
        commissionMinor: {
          $sum: { $cond: [{ $eq: ["$kind", "commission"] }, { $multiply: ["$amountMinor", -1] }, 0] },
        },
        vatMinor: {
          $sum: { $cond: [{ $eq: ["$kind", "vat"] }, { $multiply: ["$amountMinor", -1] }, 0] },
        },
        ownerVatMinor: {
          $sum: { $cond: [{ $eq: ["$kind", "owner_vat"] }, { $multiply: ["$amountMinor", -1] }, 0] },
        },
        lastEntryAt: { $max: "$occurredAt" },
      },
    },
  ]);

  const figures = totals || {
    entryCount: 0,
    netMinor: 0,
    withdrawnMinor: 0,
    grossMinor: 0,
    commissionMinor: 0,
    vatMinor: 0,
    ownerVatMinor: 0,
    lastEntryAt: null,
  };
  delete figures._id;

  return LedgerBalance.findOneAndUpdate(
    { ...ownerFilter(owner), currency, stream },
    {
      $set: {
        owner,
        currency,
        stream,
        ...figures,
        availableMinor: figures.netMinor - figures.withdrawnMinor,
      },
      $inc: { version: 1 },
    },
    { new: true, upsert: true }
  );
};

module.exports = {
  append,
  recordSale,
  getBalance,
  rebuildBalance,
  supportsTransactions,
  CREDIT_KINDS,
};
