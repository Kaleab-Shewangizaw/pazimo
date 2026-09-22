const mongoose = require("mongoose");

// The append-only record of every movement of money on the platform.
//
// Never updated. Never deleted. A mistake is corrected by appending its
// reversal, which is why refunds are a `kind` rather than a deletion — the
// history of what happened is itself the thing being stored.
//
// WHY THIS EXISTS (REBUILD_PLAN Phase 3)
//
// Today every balance is RECOMPUTED from history on each read: an organizer's
// balance scans their tickets and re-derives commission and VAT per row. That
// single fact is the root of most of the money problems three audits found —
// four divergent balance formulas, a loan that un-repaid itself, refunds being
// impossible to express, the withdrawal double-spend race, and the slow balance
// query. Storing the movement instead of re-deriving it fixes the class.
//
// THE THREE RULES
//
// 1. Integers only. amountMinor is minor units (cents). A persisted running
//    total accumulates its own rounding error and nothing washes it out later.
//    See utils/money.js.
// 2. Signed from the OWNER's perspective. A sale credits, commission and
//    withdrawals debit. The owner's balance is therefore the plain sum of
//    amountMinor — no per-kind interpretation needed at read time, which is
//    what makes reads O(1) against the projection.
// 3. Idempotent. idempotencyKey is unique, so replaying a webhook, retrying a
//    failed request or re-running a backfill cannot double-count.

const OWNER_KINDS = ["organizer", "venue", "cinema", "platform"];

// The pools money is kept in. Mirrors Withdrawal.stream, which is the same
// distinction on the payout side: tickets and drinks settle separately.
//
// "capital" is Pazimo Capital's own pool — a loan's principal, and nothing
// else. It never mixes with "tickets": a loan is credited once at approval,
// not earned per sale, so it must not inflate ticket gross/net or an
// organizer's ticket withdrawal balance. See ledgerService's PROJECTION_FIELD
// and rebuildBalance for how this stream's own gross/net stay consistent.
const STREAMS = ["tickets", "beverages", "capital"];

const ENTRY_KINDS = [
  // Credits to the seller
  "ticket_sale",
  "beverage_sale",
  "loan_principal",
  // Debits from the seller
  "commission",
  "vat",
  "owner_vat",
  "withdrawal",
  "loan_repayment",
  "refund",
  // Reversals of a debit (a cancelled withdrawal returning to the pool)
  "withdrawal_reversal",
];

const LedgerEntrySchema = new mongoose.Schema(
  {
    // Who this movement belongs to.
    //
    // A discriminated reference rather than four nullable id fields, because
    // an entry belongs to exactly one owner and "which of these four is set?"
    // is a question no reader should have to ask. "platform" is Pazimo itself —
    // commission and VAT are debited from a seller and credited here, so the
    // admin's totals are the same O(1) read as everyone else's.
    owner: {
      kind: {
        type: String,
        enum: OWNER_KINDS,
        required: true,
      },
      id: {
        // No `ref`: this points into User, Venue, Cinema or nothing at all
        // (platform), so a single populate target would be wrong three times
        // out of four. Readers resolve it via owner.kind.
        type: mongoose.Schema.Types.ObjectId,
        required: function () {
          return this.owner?.kind !== "platform";
        },
      },
    },

    currency: {
      type: String,
      enum: ["ETB", "USD"],
      default: "ETB",
      required: true,
    },

    stream: {
      type: String,
      enum: STREAMS,
      required: true,
    },

    kind: {
      type: String,
      enum: ENTRY_KINDS,
      required: true,
    },

    // Signed, in minor units, from the owner's perspective.
    amountMinor: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "amountMinor must be an integer number of minor units",
      },
    },

    // The owner's running balance immediately after this entry.
    //
    // Stored rather than derived so that a single entry answers "what was the
    // balance at this moment" — which is what makes an audit possible at all.
    // It also means a corrupted projection can be detected: the latest entry's
    // balanceAfterMinor must equal the projection's balance.
    balanceAfterMinor: {
      type: Number,
      validate: {
        validator: (v) => v === undefined || v === null || Number.isInteger(v),
        message: "balanceAfterMinor must be an integer number of minor units",
      },
    },

    // What caused this movement. Exactly one is normally set; all are optional
    // because a backfill or an adjustment may have no single source row.
    source: {
      ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
      cinemaTicket: { type: mongoose.Schema.Types.ObjectId, ref: "CinemaTicket" },
      beverageSale: { type: mongoose.Schema.Types.ObjectId, ref: "BeverageSale" },
      venueBeverageSale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VenueBeverageSale",
      },
      cinemaBeverageSale: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CinemaBeverageSale",
      },
      withdrawal: { type: mongoose.Schema.Types.ObjectId, ref: "Withdrawal" },
      loan: { type: mongoose.Schema.Types.ObjectId, ref: "Loan" },
      // Free-text for entries with no row behind them (a backfill, a manual
      // correction). Never parsed — it is for a human reading an audit.
      note: { type: String, trim: true },
    },

    /**
     * What makes replay safe.
     *
     * Built from the source row and the kind, e.g. "ticket_sale:<ticketId>" and
     * "commission:<ticketId>" — so the four entries a single sale produces each
     * get their own key, and re-processing that sale writes none of them twice.
     *
     * The unique index is the actual guarantee; the service catches the
     * duplicate-key error and treats it as success.
     */
    idempotencyKey: {
      type: String,
      required: true,
    },

    // When the money actually moved, which is not always when the row was
    // written — a backfill inserts today an entry that happened months ago, and
    // every report must use this rather than createdAt.
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { timestamps: true }
);

// The guarantee that makes every write path replay-safe.
LedgerEntrySchema.index({ idempotencyKey: 1 }, { unique: true });

// The statement view: one owner's pool, newest first.
LedgerEntrySchema.index({
  "owner.kind": 1,
  "owner.id": 1,
  currency: 1,
  stream: 1,
  occurredAt: -1,
});

// Rebuilding a projection walks an owner's entries in the order they happened.
LedgerEntrySchema.index({ "owner.kind": 1, "owner.id": 1, occurredAt: 1, _id: 1 });

// Platform reporting: "all commission in this period", across every seller.
LedgerEntrySchema.index({ kind: 1, currency: 1, occurredAt: -1 });

// Tracing a source row back to the entries it produced, for reconciliation.
LedgerEntrySchema.index({ "source.ticket": 1 }, { sparse: true });
LedgerEntrySchema.index({ "source.cinemaTicket": 1 }, { sparse: true });
LedgerEntrySchema.index({ "source.withdrawal": 1 }, { sparse: true });

module.exports = mongoose.model("LedgerEntry", LedgerEntrySchema);
module.exports.OWNER_KINDS = OWNER_KINDS;
module.exports.ENTRY_KINDS = ENTRY_KINDS;
module.exports.STREAMS = STREAMS;
