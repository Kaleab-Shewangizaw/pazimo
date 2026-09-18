const mongoose = require("mongoose");

// Created when a "cashier" account redeems an EventCashierCode (see
// eventCashierController.redeemEventCode) — the event-scoped twin of
// UsherEventAccess. A cinema/venue cashier is scoped to its one business
// permanently via the `cinema`/`venue` field on its own User doc; an EVENT
// cashier has neither set (see User.js's relaxed pre-validate hook) and is
// instead scoped, one event at a time, by this grant — exactly how an usher
// is scoped, just for beverage redemption instead of ticket check-in.
//
// Persists until explicitly revoked by the event's organizer or an admin —
// rotating the event's code afterwards does not touch grants already made
// under an earlier code. beverageSalesController's redeemBeverageSale checks
// this collection on every redeem, never the code itself.
//
// A cashier holds at most one live (revokedAt: null) grant at a time —
// redeeming a different event's code revokes whatever was live before
// creating the new one (see redeemEventCode), so it is always scoped to
// exactly one event, never several concurrently.
const CashierEventAccessSchema = new mongoose.Schema(
  {
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
    // null while the grant is active. Set (never deleted) on revoke so the
    // event's cashier history stays auditable instead of just disappearing.
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

CashierEventAccessSchema.index({ cashier: 1, event: 1 }, { unique: true });
CashierEventAccessSchema.index({ event: 1, cashier: 1, revokedAt: 1 });
CashierEventAccessSchema.index(
  { cashier: 1 },
  { unique: true, partialFilterExpression: { revokedAt: null } }
);

module.exports = mongoose.model("CashierEventAccess", CashierEventAccessSchema);
