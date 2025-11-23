const Notification = require("../models/Notification");

// Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('Fetching notifications for userId:', userId);
    
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    console.log('Found notifications:', notifications.length);
    
    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

// Mark notifications as read
exports.markNotificationsRead = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
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
    const userId = req.user._id; // Use _id from the full user object

    console.log('Deleting notification:', { notificationId, userId });

    // Find and delete the notification, ensuring it belongs to the user
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: userId
    });

    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: "Notification not found or you don't have permission to delete it" 
      });
    }

    console.log('Notification deleted successfully:', notification._id);
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

// Delete multiple notifications
exports.deleteMultipleNotifications = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id; // Use _id from the full user object

    console.log('Deleting multiple notifications:', { notificationIds, userId });

    // Delete multiple notifications, ensuring they belong to the user
    const result = await Notification.deleteMany({
      _id: { $in: notificationIds },
      userId: userId
    });

    console.log('Deleted notifications count:', result.deletedCount);
    res.json({ 
      success: true, 
      message: `${result.deletedCount} notification(s) deleted successfully` 
    });
  } catch (err) {
    console.error('Error deleting notifications:', err);
    res.status(500).json({ success: false, message: "Failed to delete notifications" });
  }
}; 