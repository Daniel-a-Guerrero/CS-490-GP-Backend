//admins/service.js
const { db } = require("../../config/database");

exports.getUserEngagement = async () => {
  const [activeUsers] = await db.query(
    `SELECT COUNT(*) AS active_user_count FROM users WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
  );
  const [totalUsers] = await db.query(
    `SELECT COUNT(*) AS total_user_count FROM users`
  );
  return {
    activeUsers: activeUsers[0],
    totalUsers: totalUsers[0]
  };
};

exports.getAppointmentTrends = async () => {
  const [trends] = await db.query(
    `SELECT HOUR(scheduled_time) AS hour, COUNT(*) AS appointments
     FROM appointments
     WHERE scheduled_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY hour
     ORDER BY hour`
  );
  return trends;
};

exports.getSalonRevenues = async () => {
  const [revenues] = await db.query(
    `SELECT s.salon_id, s.name AS salon_name, SUM(p.amount) AS total_revenue
     FROM payments p
     JOIN appointments a ON p.appointment_id = a.appointment_id
     JOIN salons s ON a.salon_id = s.salon_id
     WHERE p.payment_status = 'completed'
     GROUP BY s.salon_id, s.name`
  );
  return revenues;
};

exports.getLoyaltyUsage = async () => {
  const [usage] = await db.query(
    `SELECT salon_id, SUM(points) AS total_points
     FROM loyalty
     WHERE last_earned >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY salon_id`
  );
  return usage;
};

exports.getUserDemographics = async () => {
  const [demographics] = await db.query(
    `SELECT user_role, COUNT(*) AS count FROM users GROUP BY user_role`
  );
  return demographics;
};

exports.getCustomerRetention = async () => {
  const [retention] = await db.query(
    `SELECT user_id FROM appointments
     WHERE scheduled_time >= DATE_SUB(NOW(), INTERVAL 90 DAY)
     GROUP BY user_id
     HAVING COUNT(appointment_id) > 1`
  );
  let count = 0;
  if (retention) {
    count = retention.length;
  }
  return { retained_customers: count };
};

exports.getReports = async () => {
  const [reports] = await db.query(
    `SELECT s.salon_id, s.name AS salon_name, SUM(p.amount) AS total_sales
     FROM payments p
     JOIN appointments a ON p.appointment_id = a.appointment_id
     JOIN salons s ON a.salon_id = s.salon_id
     WHERE p.payment_status = 'completed'
     GROUP BY s.salon_id, s.name`
  );
  return reports;
};

exports.getSystemLogs = async () => {
  const [logs] = await db.query(
    `SELECT event_type, COUNT(*) AS count
     FROM salon_audit
     WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY event_type
     ORDER BY count DESC
     LIMIT 50`
  );
  return logs;
};

exports.updateSalonReg = async (sid, status) =>{
  const [logs] = await db.query(`
    UPDATE salons
    SET approved=?
    WHERE salon_id=?
    `,[status, sid]);
    return { success: true };
};