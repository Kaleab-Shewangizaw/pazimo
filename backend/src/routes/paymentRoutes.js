const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateUser } = require('../middlewares/auth');

/**
 * @route POST /api/payments/initialize
 * @desc Initialize a new payment transaction
 * @access Private
 */
router.post('/initialize', authenticateUser, paymentController.initializePayment);

/**
 * @route GET /api/payments/callback
 * @desc Handle payment callback from Chapa
 * @access Public
 */
router.get('/callback', paymentController.handleCallback);

/**
 * @route GET /api/payments/verify/:tx_ref
 * @desc Verify transaction status
 * @access Private
 */
router.get('/verify/:tx_ref', authenticateUser, paymentController.verifyTransaction);

module.exports = router; 