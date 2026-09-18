const multer = require("multer");
const path = require("path");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 10, // 10MB max file size
  },
});

// Cinema admin uploads carry the cinema's own image alongside an optional
// promo video (Cinema.promoVideo) in the same request. A separate multer
// instance rather than widening `fileFilter` above: every other upload in the
// app goes through `upload` and must stay image-only, and a short promo clip
// needs a much bigger ceiling than the 10MB the image routes are tuned for.
const cinemaMediaFilter = (req, file, cb) => {
  if (file.fieldname === "promoVideo") {
    if (file.mimetype.startsWith("video")) {
      cb(null, true);
    } else {
      cb(new Error("Not a video! Please upload a video file for the promo video."), false);
    }
  } else if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new Error("Not an image! Please upload only images."), false);
  }
};

const cinemaAdminUpload = multer({
  storage: storage,
  fileFilter: cinemaMediaFilter,
  limits: {
    fileSize: 1024 * 1024 * 200, // 200MB — a short promo clip, not a feature film.
  },
});

// The platform-wide seat-selection screen clip (CinemaScreenConfig.video) —
// video-only, its own instance for the same reason cinemaAdminUpload is: it
// needs the bigger size ceiling and isn't tied to any one cinema's fields.
const screenVideoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("video")) {
    cb(null, true);
  } else {
    cb(new Error("Not a video! Please upload a video file."), false);
  }
};

const screenVideoUpload = multer({
  storage: storage,
  fileFilter: screenVideoFilter,
  limits: {
    fileSize: 1024 * 1024 * 200,
  },
});

module.exports = upload;
module.exports.cinemaAdminUpload = cinemaAdminUpload;
module.exports.screenVideoUpload = screenVideoUpload;
