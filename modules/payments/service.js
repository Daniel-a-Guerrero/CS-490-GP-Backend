//payments/service.js
const { db } = require("../../config/database");

exports.processPayment = async (user_id, amount, payment_method, appointment_id) => {
  const [result] = await db.query(
    `INSERT INTO payments (user_id, amount, payment_method, payment_status, appointment_id)
     VALUES (?, ?, ?, 'completed', ?)`,
    [user_id, amount, payment_method, appointment_id]
  );
  if (result && result.insertId) {
    return result.insertId;
  }
  return null;
};

exports.getPaymentsForSalon = async (salon_id) => {
  const [payments] = await db.query(
    `SELECT p.*, u.full_name AS customer_name
     FROM payments p
     LEFT JOIN appointments a ON p.appointment_id = a.appointment_id
     LEFT JOIN users u ON p.user_id = u.user_id
     WHERE a.salon_id = ?`,
    [salon_id]
  );
  if (payments) {
    return payments;
  }
  return [];
};

