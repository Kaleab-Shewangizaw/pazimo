const mongoose = require("mongoose");

// The current position of one owner's one pool, in one currency.
//
// A PROJECTION, not a source of truth. LedgerEntry is the truth; this is the
// running total maintained alongside it so a dashboard does not have to replay
// history to answer "how much do I have".
//
// That distinction is what makes it safe: if this document is ever wrong it can
// be discarded and rebuilt from the entries, and rebuildBalance() in
// ledgerService does exactly that. Nothing is lost by deleting a projection.
//
// WHY IT IS SHAPED LIKE THIS
//
// It carries the whole breakdown — gross, commission, VAT, withheld owner VAT,
// net, withdrawn, pending — rather than a single number, because every screen
// that asks for a balance also asks for those. Keeping them here means the
// finance page, the withdrawal form and the admin overview are all one document
// read instead of an aggregation each.
//
// One document per (owner, currency, stream). The stream split mirrors
// Withdrawal.stream: ticket and drink money are settled independently, so they
// are counted independently. Summing them for display is the caller's choice,
// never this model's assumption.

const LedgerBalanceSchema = new mongoose.Schema(
  {
    owner: {
      kind: {
        type: String,
        enum: ["organizer", "venue", "cinema", "platform"],
        required: true,
      },
      id: {
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
      enum: ["tickets", "beverages"],
      required: true,
    },

    // --- The breakdown, all in integer minor units --------------------------

    /** Everything sold, before any deduction. */
    grossMinor: { type: Number, default: 0 },
    /** Pazimo's fee. Positive here; stored as a debit on the owner's entries. */
    commissionMinor: { type: Number, default: 0 },
    /** Government VAT on that fee — 15% OF the commission, not of the sale. */
    vatMinor: { type: Number, default: 0 },
    /**
     * The owner's own VAT, withheld only where Pazimo covers them.
     *
     * A liability Pazimo remits on their behalf, never Pazimo revenue. It is
     * kept as its own figure precisely so that no "what did Pazimo earn"
     * report can accidentally include it.
     */
    ownerVatMinor: { type: Number, default: 0 },
    /** What the owner earned: gross - commission - vat - ownerVat. */
    netMinor: { type: Number, default: 0 },

    /** Payouts already approved or completed. */
    withdrawnMinor: { type: Number, default: 0 },
    /** Payouts requested and awaiting an admin. Held against the balance. */
    pendingMinor: { type: Number, default: 0 },

    /**
     * What may be withdrawn right now: netMinor - withdrawnMinor - pendingMinor.
     *
     * Stored rather than computed on read so a withdrawal check is a single
     * indexed lookup — and, once money movements run inside a transaction, so
     * the check and the debit can be made atomic. The absence of that atomicity
     * is the withdrawal double-spend race the rebuild plan names.
     */
    availableMinor: { type: Number, default: 0 },

    // --- Integrity ---------------------------------------------------------

    /** How many entries are folded into the figures above. */
    entryCount: { type: Number, default: 0 },
    /**
     * The last entry applied.
     *
     * Lets a reconciler check the projection against the ledger cheaply: this
     * entry's balanceAfterMinor must equal availableMinor's underlying net
     * position. A mismatch means the projection drifted and should be rebuilt.
     */
    lastEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerEntry" },
    lastEntryAt: { type: Date },

    /**
     * Optimistic-concurrency counter, bumped on every apply.
     *
     * On a standalone MongoDB (no transactions — every dev machine) this is the
     * only thing standing between two concurrent withdrawals and a double
     * spend. On a replica set the transaction covers it and this is belt and
     * braces.
     */
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One projection per owner+currency+stream. Unique so a race that tries to
// create two ends with one, and the loser retries against the winner.
LedgerBalanceSchema.index(
  { "owner.kind": 1, "owner.id": 1, currency: 1, stream: 1 },
  { unique: true }
);
// The admin overview lists every seller's position in one query.
LedgerBalanceSchema.index({ "owner.kind": 1, currency: 1, availableMinor: -1 });

module.exports = mongoose.model("LedgerBalance", LedgerBalanceSchema);
