const { db } = require("../../config/database");

const ALLOWED_STATUSES = new Set([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

function normalizeStatus(status, fallback = "pending") {
  if (!status) return fallback;
  const normalized = String(status).toLowerCase();
  if (normalized === "canceled") return "cancelled";
  if (normalized === "booked") return "confirmed";
  if (ALLOWED_STATUSES.has(normalized)) {
    return normalized;
  }
  return fallback;
}

/**
 * Helper: insert or update appointment_services rows
 */
async function addAppointmentServices(appointmentId, services) {
  if (!Array.isArray(services) || services.length === 0) return;

  const sql = `
    INSERT INTO appointment_services (appointment_id, service_id, duration, price)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      duration = VALUES(duration),
      price = VALUES(price)
  `;

  const values = services.map((s) => [
    appointmentId,
    s.service_id,
    s.duration,
    s.price,
  ]);

  await db.query(sql, [values]);
}

/**
 *  Helper: fetch all services attached to an appointment
 */
async function getAppointmentServices(appointmentId) {
  const sql = `
    SELECT asv.service_id, sv.custom_name, asv.duration, asv.price
    FROM appointment_services asv
    JOIN services sv ON asv.service_id = sv.service_id
    WHERE asv.appointment_id = ?
  `;
  const [rows] = await db.query(sql, [appointmentId]);
  return rows;
}

/**
 * Create a new appointment (supports single or multiple services)
 */
async function createAppointment(
  userId,
  salonId,
  staffId,
  serviceInput,
  scheduledTime,
  price,
  notes,
  status
) {
  const normalizedStatus = normalizeStatus(status, "pending");
  const sql = `
    INSERT INTO appointments 
      (user_id, salon_id, staff_id, scheduled_time, price, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const [result] = await db.query(sql, [
    userId,
    salonId,
    staffId || null,
    scheduledTime,
    price,
    notes,
    normalizedStatus,
  ]);

  const appointmentId = result.insertId;

  // Handle multiple services if array passed
  if (Array.isArray(serviceInput)) {
    await addAppointmentServices(appointmentId, serviceInput);
  } else if (serviceInput) {
    // single service fallback
    const [svc] = await db.query(
      "SELECT duration, price FROM services WHERE service_id = ?",
      [serviceInput]
    );
    if (svc.length) {
      await addAppointmentServices(appointmentId, [
        {
          service_id: serviceInput,
          duration: svc[0].duration,
          price: svc[0].price,
        },
      ]);
    }
  }

  return appointmentId;
}

/**
 * Get all appointments for a user
 */
async function getAppointmentsByUser(userId) {
  const sql = `
    SELECT 
      a.appointment_id,
      a.scheduled_time,
      a.status,
      a.price,
      s.salon_name AS salon_name,
      GROUP_CONCAT(sv.custom_name SEPARATOR ', ') AS service_names,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN salons s ON a.salon_id = s.salon_id
    LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
    LEFT JOIN services sv ON aps.service_id = sv.service_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.user_id = ?
    GROUP BY a.appointment_id
    ORDER BY a.scheduled_time DESC
  `;
  const [rows] = await db.query(sql, [userId]);
  return rows;
}

/**
 * Get appointment by ID
 */
async function getAppointmentById(appointmentId) {
  const sql = `
    SELECT 
      a.appointment_id,
      a.user_id,
      a.salon_id,
      a.staff_id,
      a.scheduled_time,
      a.status,
      a.price,
      a.notes,
      s.salon_name AS salon_name,
      cu.full_name AS customer_name,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN salons s ON a.salon_id = s.salon_id
    LEFT JOIN users cu ON cu.user_id = a.user_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.appointment_id = ?
  `;
  const [rows] = await db.query(sql, [appointmentId]);
  if (!rows.length) return null;

  const appointment = rows[0];
  appointment.services = await getAppointmentServices(appointmentId);
  return appointment;
}

/**
 * Update appointment (supports multiple services)
 */
async function updateAppointment(appointmentId, updates) {
  const [rows] = await db.query(
    `SELECT staff_id, scheduled_time, price, notes, status 
     FROM appointments WHERE appointment_id = ?`,
    [appointmentId]
  );
  if (!rows.length) return 0;
  const current = rows[0];

  const final = {
    staff_id: updates.hasOwnProperty("staff_id")
      ? updates.staff_id
      : current.staff_id,
    scheduled_time: updates.hasOwnProperty("scheduled_time")
      ? updates.scheduled_time
      : current.scheduled_time,
    price: updates.hasOwnProperty("price") ? updates.price : current.price,
    notes: updates.hasOwnProperty("notes") ? updates.notes : current.notes,
    status: current.status,
  };

  if (updates.hasOwnProperty("status")) {
    final.status = normalizeStatus(updates.status, current.status);
  }

  const sql = `
    UPDATE appointments
    SET staff_id = ?, scheduled_time = ?, price = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE appointment_id = ?
  `;
  const [result] = await db.query(sql, [
    final.staff_id,
    final.scheduled_time,
    final.price,
    final.notes,
    final.status,
    appointmentId,
  ]);

  if (result.affectedRows === 0) return 0;

  // Handle multiple services if provided
  if (Array.isArray(updates.services)) {
    await db.query(
      "DELETE FROM appointment_services WHERE appointment_id = ?",
      [appointmentId]
    );
    await addAppointmentServices(appointmentId, updates.services);
  }

  const updated = await getAppointmentById(appointmentId);
  return updated;
}

/**
 * Cancel appointment
 */
async function cancelAppointment(appointmentId) {
  const sql = `
    UPDATE appointments 
    SET status = 'cancelled'
    WHERE appointment_id = ?
  `;
  const [result] = await db.query(sql, [appointmentId]);
  return result.affectedRows;
}

/**
 * Automatically cancel pending appointments that have been waiting >24h
 */
async function expireStalePendingAppointments() {
  const sql = `
    UPDATE appointments
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending'
      AND scheduled_time < DATE_SUB(NOW(), INTERVAL 24 HOUR)
  `;
  await db.query(sql);
}

/**
 * Get all appointments for a salon
 */
async function getAppointmentsBySalon(
  salonId,
  date = null,
  from = null,
  to = null
) {
  let sql = `
    SELECT 
      a.appointment_id,
      a.scheduled_time,
      a.status,
      a.price,
      a.notes,
      cu.full_name AS customer_name,
      cu.profile_pic AS customer_avatar,
      GROUP_CONCAT(sv.custom_name SEPARATOR ', ') AS service_names,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN users cu ON a.user_id = cu.user_id
    LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
    LEFT JOIN services sv ON aps.service_id = sv.service_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.salon_id = ?
  `;

  const params = [salonId];

  if (date) {
    sql += " AND a.scheduled_time BETWEEN ? AND ?";
    params.push(`${date} 00:00:00`, `${date} 23:59:59`);
  } else if (from && to) {
    sql += " AND a.scheduled_time BETWEEN ? AND ?";
    params.push(`${from} 00:00:00`, `${to} 23:59:59`);
  }

  sql += " GROUP BY a.appointment_id ORDER BY a.scheduled_time ASC";

  const [rows] = await db.query(sql, params);
  return rows || [];
}

module.exports = {
  createAppointment,
  getAppointmentsByUser,
  getAppointmentById,
  getAppointmentsBySalon,
  updateAppointment,
  cancelAppointment,
  expireStalePendingAppointments,
  addAppointmentServices,
  getAppointmentServices,
};
