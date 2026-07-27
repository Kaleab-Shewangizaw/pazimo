const mongoose = require("mongoose");

// Local record of gift-card operations initiated through the Pazimo admin.
// Chapa's Link API doesn't return payer phones or payout destinations on any
// read endpoint, so this is the only place those details survive. Keyed by
// the Chapa reference so the history timeline can join against it.
const GiftCardActivity = new mongoose.Schema({
  cardNumber: {
    type: String,
    required: true,
    index: true,
  },
  kind: {
    type: String,
    enum: ["create", "topup", "payout"],
    required: true,
  },
  // link_reference for top-ups, chapa_reference/initiator_reference for payouts
  reference: {
    type: String,
    index: true,
  },
  details: {
    type: Object, // payer phone/wallet, bank + account, destination card, merchant id, card owner info
  },
  initiatedBy: {
    type: String, // admin email or id
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Search / feed access patterns:
// - join by reference (single-field index above on reference)
// - feed filtered by kind, newest first
// - lookups by the phones and accounts stored inside details
GiftCardActivity.index({ kind: 1, createdAt: -1 });
GiftCardActivity.index({ "details.payer_phone": 1 });
GiftCardActivity.index({ "details.account_number": 1 });
GiftCardActivity.index({ "details.owner_phone": 1 });

module.exports = mongoose.model("GiftCardActivity", GiftCardActivity);
