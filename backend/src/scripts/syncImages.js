const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Event = require("../models/Event");
const OrganizerRegistration = require("../models/OrganizerRegistration");
const Category = require("../models/Category");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const REMOTE_BASE_URL = "https://pazimo.com/uploads";

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const downloadImage = async (filename) => {
  if (!filename) return;

  // Clean filename (remove /uploads/ prefix if present)
  const cleanFilename = filename.replace(/^\/?uploads\//, "");
  if (!cleanFilename) return;

  const localPath = path.join(UPLOADS_DIR, cleanFilename);

  if (fs.existsSync(localPath)) {
    // console.log(`Skipping ${cleanFilename} (already exists)`);
    return;
  }

  const remoteUrl = `${REMOTE_BASE_URL}/${cleanFilename}`;
  console.log(`Downloading ${remoteUrl}...`);

  try {
    const response = await axios({
      method: "GET",
      url: remoteUrl,
      responseType: "stream",
      timeout: 10000, // 10s timeout
    });

    const writer = fs.createWriteStream(localPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`Downloaded ${cleanFilename}`);
        resolve();
      });
      writer.on("error", (err) => {
        console.error(`Error writing ${cleanFilename}:`, err.message);
        writer.close();
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        reject(err);
      });
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.error(`Image not found on remote server: ${cleanFilename}`);
    } else {
      console.error(`Failed to download ${cleanFilename}:`, error.message);
    }
  }
};

const syncImages = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(
        "MONGODB_URI is not defined in .env, please pass it as env var"
      );
    }
    const uri = process.env.MONGODB_URI;
    console.log("Connecting to MongoDB:", uri);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected to MongoDB");

    // 1. Sync Events
    const events = await Event.find({});
    console.log(`Found ${events.length} events`);

    for (const event of events) {
      if (event.coverImages && event.coverImages.length > 0) {
        for (const img of event.coverImages) {
          await downloadImage(img);
        }
      }
      if (event.eventImages && event.eventImages.length > 0) {
        for (const imgObj of event.eventImages) {
          if (imgObj.url) {
            await downloadImage(imgObj.url);
          }
        }
      }
    }

    // 2. Sync Organizer Registrations
    const registrations = await OrganizerRegistration.find({});
    console.log(`Found ${registrations.length} organizer registrations`);

    for (const reg of registrations) {
      if (reg.businessLicenseUrl) {
        await downloadImage(reg.businessLicenseUrl);
      }
    }

    // 3. Sync Categories
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories`);

    for (const cat of categories) {
      if (cat.image) {
        await downloadImage(cat.image);
      }
    }

    console.log("Sync complete");
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
};

syncImages();
