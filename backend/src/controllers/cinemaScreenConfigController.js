const fs = require("fs");
const path = require("path");
const { StatusCodes } = require("http-status-codes");
const CinemaScreenConfig = require("../models/CinemaScreenConfig");
const { BadRequestError } = require("../errors");

const UPLOADS_DIR = path.join(__dirname, "../../uploads");

const removeUploadedFile = (filePath) => {
  if (!filePath || typeof filePath !== "string") return;
  const filename = path.basename(filePath);
  if (!filename || filename === "." || filename === "..") return;
  fs.unlink(path.join(UPLOADS_DIR, filename), (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Failed to remove screen video upload:", error.message);
    }
  });
};

// Singleton, same pattern as PlatformFeeConfig: one row, created on first read.
const getSingleton = async () => {
  let config = await CinemaScreenConfig.findOne();
  if (!config) config = await CinemaScreenConfig.create({});
  return config;
};

// Public — every seat-selection screen (web and mobile) fetches this before
// it can show anything, so it carries no auth and no admin-only fields.
// Wrapped in { success, data } to match the rest of this file's public
// route group (cinemaProgrammeController's public endpoints), which is what
// the frontend's shared `publicGet` helper unwraps.
exports.getScreenVideo = async (req, res) => {
  const config = await getSingleton();
  res.status(StatusCodes.OK).json({ success: true, data: { video: config.video || null } });
};

exports.updateScreenVideo = async (req, res) => {
  if (!req.file) {
    throw new BadRequestError("A video file is required");
  }

  const config = await getSingleton();
  const previous = config.video;

  config.video = `/uploads/${req.file.filename}`;
  config.videoSetBy = req.user.userId;
  config.videoSetAt = new Date();
  await config.save();

  if (previous) removeUploadedFile(previous);

  res.status(StatusCodes.OK).json({ video: config.video, videoSetAt: config.videoSetAt });
};
