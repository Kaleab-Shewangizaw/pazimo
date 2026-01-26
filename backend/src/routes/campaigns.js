const express = require("express");
const router = express.Router();
const campaignController = require("../controllers/campaignController");
const { protect } = require("../middlewares/auth");

// Public Webhooks (must be before protect or explicitly excluded)
router.post("/webhook/santim", campaignController.santimWebhook);

// Protected Routes
router.get("/", protect, campaignController.getCampaigns);
router.post("/", protect, campaignController.finalizeCampaign);
router.post("/draft", protect, campaignController.createDraft);
router.delete("/:id", protect, campaignController.deleteCampaign);

// Payment Routes
router.post("/payment/initiate", protect, campaignController.initiatePayment);
router.get(
  "/payment/status/:transactionId",
  protect,
  campaignController.checkPaymentStatus,
);

module.exports = router;
