//notifications/controller.js
const notificationService = require("./service");

exports.sendAppointmentReminder = async (req, res) => {
  try {
    const { user_id, message, scheduled_for } = req.body;
    await notificationService.sendAppointmentReminder(user_id, message, scheduled_for);
    res.json({ message: "Reminder scheduled" });
  } catch (err) {
    console.error("Reminder error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.sendPromotionalOffer = async (req, res) => {
  try {
    const { user_ids, message, scheduled_for } = req.body;
    await notificationService.sendPromotionalOffer(user_ids, message, scheduled_for);
    res.json({ message: "Offers queued" });
  } catch (err) {
    console.error("Promo error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.notifyClientDelay = async (req, res) => {
  try {
    const { user_id, message } = req.body;
    await notificationService.notifyClientDelay(user_id, message);
    res.json({ message: "Client notified" });
  } catch (err) {
    console.error("Delay error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.notifyUserDiscount = async (req, res) => {
  try {
    const { user_id, message } = req.body;
    await notificationService.notifyUserDiscount(user_id, message);
    res.json({ message: "Discount sent" });
  } catch (err) {
    console.error("Discount error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getUserNotifications = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    
    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    const notifications = await notificationService.getUserNotifications(user_id);
    res.json(notifications);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification_id = req.params.id;
    const user_id = req.user.user_id || req.user.id;
    
    await notificationService.markNotificationRead(notification_id, user_id);
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    
    await notificationService.markAllNotificationsRead(user_id);
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ error: err.message });
  }
};

