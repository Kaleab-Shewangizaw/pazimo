const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { authenticateUser } = require("../middlewares/auth");

/**
 * @route GET /api/payments/status
 * @desc Check payment status by transaction ID
 * @access Public
 */
router.get("/status", paymentController.checkPaymentStatus);

/**
 * @route POST /api/payments/cancel
 * @desc Cancel a pending payment
 * @access Public
 */
router.post("/cancel", paymentController.cancelPayment);

module.exports = router;
