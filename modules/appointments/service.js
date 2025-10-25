const { query } = require('../../config/database');

async function createAppointment(userId, salonId, staffId, serviceId, scheduledTime, price, notes) {
  const sql = `INSERT INTO appointments (user_id, salon_id, staff_id, service_id, scheduled_time, price, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'booked')`;
  const result = await query(sql, [userId, salonId, staffId, serviceId, scheduledTime, price, notes]);
  return result.insertId;
}

async function getAppointmentsByUser(userId) {
  const sql = `SELECT a.*, s.name as salon_name, st.full_name as staff_name, sv.custom_name as service_name FROM appointments a LEFT JOIN salons s ON a.salon_id = s.salon_id LEFT JOIN staff st ON a.staff_id = st.staff_id LEFT JOIN services sv ON a.service_id = sv.service_id WHERE a.user_id = ? ORDER BY a.scheduled_time DESC`;
  const appointments = await query(sql, [userId]);
  return appointments;
}

async function getAppointmentById(appointmentId) {
  const sql = `SELECT a.*, s.name as salon_name, st.full_name as staff_name, sv.custom_name as service_name FROM appointments a LEFT JOIN salons s ON a.salon_id = s.salon_id LEFT JOIN staff st ON a.staff_id = st.staff_id LEFT JOIN services sv ON a.service_id = sv.service_id WHERE a.appointment_id = ?`;
  const appointments = await query(sql, [appointmentId]);
  if (appointments.length > 0) {
    return appointments[0];
  }
  return null;
}

async function updateAppointment(appointmentId, updates) {
  let sql = 'UPDATE appointments SET ';
  let values = [];
  let first = true;
  
  if (updates.staffId) {
    sql += 'staff_id = ?';
    values.push(updates.staffId);
    first = false;
  }
  if (updates.serviceId) {
    if (!first) sql += ', ';
    sql += 'service_id = ?';
    values.push(updates.serviceId);
    first = false;
  }
  if (updates.scheduledTime) {
    if (!first) sql += ', ';
    sql += 'scheduled_time = ?';
    values.push(updates.scheduledTime);
    first = false;
  }
  if (updates.price !== undefined) {
    if (!first) sql += ', ';
    sql += 'price = ?';
    values.push(updates.price);
    first = false;
  }
  if (updates.notes) {
    if (!first) sql += ', ';
    sql += 'notes = ?';
    values.push(updates.notes);
    first = false;
  }
  if (updates.status) {
    if (!first) sql += ', ';
    sql += 'status = ?';
    values.push(updates.status);
    first = false;
  }
  
  sql += ' WHERE appointment_id = ?';
  values.push(appointmentId);
  
  const result = await query(sql, values);
  return result.affectedRows;
}

async function cancelAppointment(appointmentId) {
  const sql = `UPDATE appointments SET status = 'cancelled' WHERE appointment_id = ?`;
  const result = await query(sql, [appointmentId]);
  return result.affectedRows;
}

module.exports = {
  createAppointment,
  getAppointmentsByUser,
  getAppointmentById,
  updateAppointment,
  cancelAppointment
};
