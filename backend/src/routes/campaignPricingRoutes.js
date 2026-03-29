const express = require("express");
const router = express.Router();
const CampaignPricing = require("../models/CampaignPricing");

// Get global campaign pricing
router.get("/", async (req, res) => {
  try {
    const pricing = await CampaignPricing.findOne();

    res.json({
      success: true,
      data: {
        smsPrice: pricing?.smsPrice ?? 5,
      },
    });
  } catch (error) {
    console.error("Get campaign pricing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Backward-compatible route: return same global campaign pricing for any event type
router.get("/:eventType", async (req, res) => {
  try {
    const { eventType } = req.params;

    if (!["public", "private"].includes(eventType)) {
      return res.status(400).json({ error: "Invalid event type" });
    }

    const pricing = await CampaignPricing.findOne();

    res.json({
      success: true,
      data: { smsPrice: pricing?.smsPrice ?? 5 },
    });
  } catch (error) {
    console.error("Get campaign pricing by type error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update campaign pricing (admin)
router.put("/", async (req, res) => {
  try {
    const incomingSmsPrice =
      req.body?.smsPrice ?? req.body?.public?.smsPrice ?? req.body?.private?.smsPrice;

    const smsPrice = parseFloat(incomingSmsPrice);

    if (Number.isNaN(smsPrice) || smsPrice < 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid smsPrice value",
      });
    }

    const existing = await CampaignPricing.findOne();
    if (existing) {
      existing.smsPrice = smsPrice;
      await existing.save();
    } else {
      await CampaignPricing.create({ smsPrice });
    }

    res.json({
      success: true,
      message: "Campaign pricing updated successfully",
    });
  } catch (error) {
    console.error("Update campaign pricing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;