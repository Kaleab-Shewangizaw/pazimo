const Notification = require("../models/Notification");

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;

    // `protect` only proves the caller is *someone*, not that they own this
    // notification feed — without this check any logged-in account (even a
    // freshly self-registered one) could read any other user's notifications
    // by id. Found 2026-09-03 during the incident review; not part of the
    // 2026-08-20 write-surface fix, which didn't cover this route.
    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view these notifications",
      });
    }

    const notifications = await Notification.find({ userId }).sort({
      createdAt: -1,
    });

    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
};

// Mark notifications as read
exports.markNotificationsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    // Scoped to the caller's own notifications — previously any authenticated
    // user could mark arbitrary notification IDs (belonging to anyone) as
    // read. Confirmed 2026-09-04 during final pre-PR review.
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId: req.user._id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

// Delete a single notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    const userId = req.user._id; // Use _id from the full user object

    console.log("Deleting notification:", { notificationId, userId });

    // Find and delete the notification, ensuring it belongs to the user
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message:
          "Notification not found or you don't have permission to delete it",
      });
    }

    console.log("Notification deleted successfully:", notification._id);
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notification" });
  }
};

// Delete multiple notifications
exports.deleteMultipleNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;

    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    const userId = req.user._id; // Use _id from the full user object

    console.log("Deleting multiple notifications:", {
      notificationIds,
      userId,
    });

    // Delete multiple notifications, ensuring they belong to the user
    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId: userId,
    });

    console.log("Deleted notifications count:", result.deletedCount);
    res.json({
      success: true,
      message: `${result.deletedCount} notification(s) deleted successfully`,
    });
  } catch (err) {
    console.error("Error deleting notifications:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notifications" });
  }
};
