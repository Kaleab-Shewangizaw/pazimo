const express = require('express');
const router = express.Router();
const { chapaWebhook, chapaGiftCardWebhook } = require('../controllers/webhookController');

// Chapa webhook endpoint (no authentication required)
router.post('/chapa', chapaWebhook);

// Chapa Link (gift card) webhook — separate URL, registered via Chapa
// support/account manager, not the merchant dashboard.
router.post('/chapa-giftcard', chapaGiftCardWebhook);

module.exports = router;