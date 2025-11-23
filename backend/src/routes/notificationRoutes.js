const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { protect } = require("../middlewares/auth");

// Get notifications for a user
router.get("/user/:userId", protect, notificationController.getUserNotifications);

// Mark notifications as read
router.post("/mark-read", protect, notificationController.markNotificationsRead);

// Delete a single notification
router.delete("/:notificationId", protect, notificationController.deleteNotification);

// Delete multiple notifications
router.delete("/", protect, notificationController.deleteMultipleNotifications);

module.exports = router; 