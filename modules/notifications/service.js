//notifications/service.js
const { db } = require("../../config/database");

exports.sendAppointmentReminder = async (user_id, message, scheduled_for) => {
  const [result] = await db.query(
    `INSERT INTO notification_queue (user_id, message, delivery_method, scheduled_for, sent)
     VALUES (?, ?, 'email', ?, FALSE)`,
    [user_id, message, scheduled_for]
  );
  return result.insertId;
};

exports.sendPromotionalOffer = async (user_ids, message, scheduled_for) => {
  const results = [];
  for (let i = 0; i < user_ids.length; i++) {
    const user_id = user_ids[i];
    const [result] = await db.query(
      `INSERT INTO notification_queue (user_id, message, delivery_method, scheduled_for, sent)
       VALUES (?, ?, 'push', ?, FALSE)`,
      [user_id, message, scheduled_for]
    );
    results.push(result.insertId);
  }
  return results;
};

exports.notifyClientDelay = async (user_id, message) => {
  const [result] = await db.query(
    `INSERT INTO notification_queue (user_id, message, delivery_method, scheduled_for, sent)
     VALUES (?, ?, 'sms', NOW(), FALSE)`,
    [user_id, message]
  );
  return result.insertId;
};

exports.notifyUserDiscount = async (user_id, message) => {
  const [result] = await db.query(
    `INSERT INTO notification_queue (user_id, message, delivery_method, scheduled_for, sent)
     VALUES (?, ?, 'email', NOW(), FALSE)`,
    [user_id, message]
  );
  return result.insertId;
};

exports.getUserNotifications = async (user_id) => {
  const [notifications] = await db.query(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
    [user_id]
  );
  return notifications;
};

exports.markNotificationRead = async (notification_id, user_id) => {
  const [result] = await db.query(
    `UPDATE notifications SET read_status = 1 WHERE notification_id = ? AND user_id = ?`,
    [notification_id, user_id]
  );
  return result.affectedRows > 0;
};

exports.markAllNotificationsRead = async (user_id) => {
  const [result] = await db.query(
    `UPDATE notifications SET read_status = 1 WHERE user_id = ?`,
    [user_id]
  );
  return result.affectedRows;
};

