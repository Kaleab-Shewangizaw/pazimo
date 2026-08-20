const ledger = require("./ledgerService");

// The bridge from the live money paths into the ledger, while both run.
//
// REBUILD_PLAN Phase 3 is explicit: build alongside the existing path,
// dual-write, do NOT cut over. Reads still come from the old formulas; these
// calls only keep the ledger current so the reconciler can prove the two agree
// before anything depends on it.
//
// THE ONE RULE HERE: A LEDGER FAILURE MUST NEVER FAIL A SALE.
//
// Until reads are cut over, the ledger is a shadow copy. A customer who has
// paid must get their ticket even if the shadow write fails, so every call is
// wrapped and errors are logged rather than thrown. The alternative — letting a
// projection conflict roll back a paid ticket — would make the migration
// itself an outage.
//
// That safety has a cost: a failed shadow write leaves the ledger behind. It is
// recoverable, because the source rows are still the truth and
// backfillLedger.js is idempotent — re-running it fills any gap. The
// reconciler is what surfaces that a gap exists.

const failures = { count: 0, lastError: null, lastAt: null };

const guard = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    failures.count += 1;
    failures.lastError = error.message;
    failures.lastAt = new Date();
    console.error(
      `[ledger:dual-write] ${label} failed (sale is unaffected): ${error.message}`
    );
    return null;
  }
};

/** Mirror a completed sale into the ledger. */
const mirrorSale = ({
  owner,
  stream,
  grossAmount,
  commissionRate,
  ownerVatRate,
  source,
  reference,
  occurredAt,
  currency = "ETB",
}) =>
  guard(`sale ${reference}`, () =>
    ledger.recordSale({
      owner,
      currency,
      stream,
      grossAmount,
      commissionRate,
      ownerVatRate,
      source,
      reference,
      occurredAt,
    })
  );

/** Mirror a payout request or its reversal. */
const mirrorWithdrawal = ({
  owner,
  stream,
  amount,
  withdrawalId,
  currency = "ETB",
  reversal = false,
  occurredAt,
}) =>
  guard(`withdrawal ${withdrawalId}`, () =>
    ledger.append({
      owner,
      currency,
      stream,
      kind: reversal ? "withdrawal_reversal" : "withdrawal",
      amountMinor: require("../utils/money").toMinor(amount),
      source: { withdrawal: withdrawalId },
      // The reversal gets its own key so cancelling and re-requesting a payout
      // are two distinct movements rather than one overwriting the other.
      idempotencyKey: `${reversal ? "withdrawal_reversal" : "withdrawal"}:${withdrawalId}`,
      occurredAt,
    })
  );

/** Mirror a refund: the reversal of a sale that already settled. */
const mirrorRefund = ({
  owner,
  stream,
  amount,
  reference,
  source,
  currency = "ETB",
  occurredAt,
}) =>
  guard(`refund ${reference}`, () =>
    ledger.append({
      owner,
      currency,
      stream,
      kind: "refund",
      amountMinor: require("../utils/money").toMinor(amount),
      source,
      idempotencyKey: `refund:${reference}`,
      occurredAt,
    })
  );

/** Health, for an admin screen or a smoke check. */
const dualWriteHealth = () => ({ ...failures });

module.exports = {
  mirrorSale,
  mirrorWithdrawal,
  mirrorRefund,
  dualWriteHealth,
};
