const express = require("express");
const router = express.Router();
const ShortUrl = require("../models/ShortUrl");

// Generate short code
const generateShortCode = () => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create short URL
router.post("/shorten", async (req, res) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: "Original URL is required" });
    }

    // Check if URL already exists
    let shortUrl = await ShortUrl.findOne({ originalUrl });

    if (shortUrl) {
      return res.json({
        success: true,
        shortCode: shortUrl.shortCode,
        shortUrl: `${
          process.env.FRONTEND_URL || "https://pazimo.vercel.app"
        }/s/${shortUrl.shortCode}`,
      });
    }

    // Generate unique short code
    let shortCode;
    let exists = true;

    while (exists) {
      shortCode = generateShortCode();
      exists = await ShortUrl.findOne({ shortCode });
    }

    // Create new short URL
    shortUrl = new ShortUrl({
      shortCode,
      originalUrl,
    });

    await shortUrl.save();

    res.json({
      success: true,
      shortCode,
      shortUrl: `${
        process.env.FRONTEND_URL || "https://pazimo.vercel.app"
      }/s/${shortCode}`,
    });
  } catch (error) {
    console.error("Shorten URL error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Redirect short URL
router.get("/:shortCode", async (req, res) => {
  try {
    const { shortCode } = req.params;

    const shortUrl = await ShortUrl.findOne({ shortCode });

    if (!shortUrl) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    // Increment click count
    shortUrl.clicks += 1;
    await shortUrl.save();

    res.redirect(shortUrl.originalUrl);
  } catch (error) {
    console.error("Redirect error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
