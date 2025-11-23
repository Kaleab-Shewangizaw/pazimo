const express = require('express');
const router = express.Router();
const { chapaWebhook } = require('../controllers/webhookController');

// Chapa webhook endpoint (no authentication required)
router.post('/chapa', chapaWebhook);

module.exports = router;