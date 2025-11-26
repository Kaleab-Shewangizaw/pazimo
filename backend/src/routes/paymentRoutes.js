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

module.exports = router;
