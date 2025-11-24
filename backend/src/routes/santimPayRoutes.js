const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  handleWebhook,
  getPaymentStatus,
  savePendingTransaction,
  fulfillPayment,
} = require("../controllers/santimPayController");

// API Routes
router.post("/api/payments/santimpay/initiate", initiatePayment);
router.get("/api/payments/status", getPaymentStatus);
router.post("/api/webhook/santimpay", handleWebhook);

// New Routes for Next.js Integration
router.post("/api/payments/santim/save-pending", savePendingTransaction);
router.post("/api/payments/santim/webhook-fulfill", fulfillPayment);

// Redirect Pages (Simple HTML for demonstration - these are handled by Next.js frontend now, but keeping as fallback or for testing)
router.get("/payment/success-test", (req, res) => {
  res.send(`
    <html>
      <body style="text-align: center; padding: 50px; font-family: sans-serif;">
        <h1 style="color: green;">Payment Successful!</h1>
        <p>Thank you for your payment.</p>
        <a href="/">Return to Home</a>
      </body>
    </html>
  `);
});

router.get("/payment/failure", (req, res) => {
  res.send(`
    <html>
      <body style="text-align: center; padding: 50px; font-family: sans-serif;">
        <h1 style="color: red;">Payment Failed</h1>
        <p>Something went wrong.</p>
        <a href="/">Try Again</a>
      </body>
    </html>
  `);
});

router.get("/payment/cancel", (req, res) => {
  res.send(`
    <html>
      <body style="text-align: center; padding: 50px; font-family: sans-serif;">
        <h1 style="color: orange;">Payment Cancelled</h1>
        <p>You cancelled the payment.</p>
        <a href="/">Return to Home</a>
      </body>
    </html>
  `);
});

module.exports = router;
