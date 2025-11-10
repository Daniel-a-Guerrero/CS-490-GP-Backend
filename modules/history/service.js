//history/service.js
const { db } = require("../../config/database");

exports.getUserHistory = async (user_id) => {
  const [rows] = await db.query(
    `SELECT 
      a.appointment_id,
      a.salon_id,
      a.staff_id,
      a.service_id,
      a.scheduled_time,
      a.status,
      a.created_at,
      s.full_name AS staff_name,
      sv.custom_name AS service_name,
      sl.name AS salon_name
     FROM appointments a
     LEFT JOIN staff st ON a.staff_id = st.staff_id
     LEFT JOIN users s ON st.user_id = s.user_id
     LEFT JOIN services sv ON a.service_id = sv.service_id
     LEFT JOIN salons sl ON a.salon_id = sl.salon_id
     WHERE a.user_id = ?
     ORDER BY a.scheduled_time DESC`,
    [user_id]
  );
  return rows;
};

exports.getSalonVisitHistory = async (salon_id) => {
  const [rows] = await db.query(
    `SELECT h.*, u.full_name AS customer_name, s.full_name AS staff_name, sv.custom_name AS service_name
     FROM history h
     LEFT JOIN users u ON h.user_id = u.user_id
     LEFT JOIN staff st ON h.staff_id = st.staff_id
     LEFT JOIN users s ON st.user_id = s.user_id
     LEFT JOIN services sv ON h.service_id = sv.service_id
     WHERE h.salon_id = ?
     ORDER BY h.visit_date DESC`,
    [salon_id]
  );
  return rows;
};

