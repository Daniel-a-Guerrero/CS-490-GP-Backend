const { db } = require("../../config/database");

/**
 * Create a new appointment
 */
async function createAppointment(
  userId,
  salonId,
  staffId,
  serviceId,
  scheduledTime,
  price,
  notes
) {
  const sql = `
    INSERT INTO appointments 
      (user_id, salon_id, staff_id, service_id, scheduled_time, price, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'booked')
  `;
  const [result] = await db.query(sql, [
    userId,
    salonId,
    staffId || null,
    serviceId,
    scheduledTime,
    price,
    notes,
  ]);
  return result.insertId;
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
      s.name AS salon_name,
      sv.custom_name AS service_name,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN salons s ON a.salon_id = s.salon_id
    LEFT JOIN services sv ON a.service_id = sv.service_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.user_id = ?
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
      a.service_id,
      a.scheduled_time,
      a.status,
      a.price,
      a.notes,
      s.salon_name AS salon_name, 
      sv.custom_name AS service_name,
      cu.full_name AS customer_name,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN salons s ON a.salon_id = s.salon_id
    LEFT JOIN services sv ON a.service_id = sv.service_id
    LEFT JOIN users cu ON cu.user_id = a.user_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.appointment_id = ?
  `;
  const [rows] = await db.query(sql, [appointmentId]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update appointment
 */
async function updateAppointment(appointmentId, updates) {
  const fields = [];
  const values = [];

  if (updates.staffId) {
    fields.push("staff_id = ?");
    values.push(updates.staffId);
  }
  if (updates.serviceId) {
    fields.push("service_id = ?");
    values.push(updates.serviceId);
  }
  if (updates.scheduledTime) {
    fields.push("scheduled_time = ?");
    values.push(updates.scheduledTime);
  }
  if (updates.price !== undefined) {
    fields.push("price = ?");
    values.push(updates.price);
  }
  if (updates.notes) {
    fields.push("notes = ?");
    values.push(updates.notes);
  }
  if (updates.status) {
    fields.push("status = ?");
    values.push(updates.status);
  }

  if (fields.length === 0) return 0;

  const sql = `UPDATE appointments SET ${fields.join(
    ", "
  )} WHERE appointment_id = ?`;
  values.push(appointmentId);

  const [result] = await db.query(sql, values);
  return result.affectedRows;
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
 * Get all appointments for a salon (owner/staff/admin)
 * Supports ?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
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
      sv.custom_name AS service_name,
      stf.staff_id,
      su.full_name AS staff_name
    FROM appointments a
    LEFT JOIN users cu ON a.user_id = cu.user_id
    LEFT JOIN services sv ON a.service_id = sv.service_id
    LEFT JOIN staff stf ON a.staff_id = stf.staff_id
    LEFT JOIN users su ON stf.user_id = su.user_id
    WHERE a.salon_id = ?
  `;

  const params = [salonId];

  // Use full-day range for single date (avoids timezone mismatch)
  if (date) {
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59`;
    sql += " AND a.scheduled_time BETWEEN ? AND ?";
    params.push(startOfDay, endOfDay);
  }
  // If a range is provided, handle it the same way
  else if (from && to) {
    sql += " AND a.scheduled_time BETWEEN ? AND ?";
    params.push(`${from} 00:00:00`, `${to} 23:59:59`);
  }

  sql += " ORDER BY a.scheduled_time ASC";

  const [rows] = await db.query(sql, params);

  // Always return an array (never undefined)
  return rows || [];
}

module.exports = {
  createAppointment,
  getAppointmentsByUser,
  getAppointmentById,
  getAppointmentsBySalon,
  updateAppointment,
  cancelAppointment,
};
