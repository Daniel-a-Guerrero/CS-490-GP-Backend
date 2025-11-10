//appointments/service.js
const { db } = require("../../config/database");

exports.bookAppointment = async (user_id, salon_id, staff_id, service_id, scheduled_time, price, notes) => {
  const [result] = await db.query(
    "INSERT INTO appointments (user_id, salon_id, staff_id, service_id, scheduled_time, price, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      user_id,
      salon_id,
      staff_id,
      service_id,
      scheduled_time,
      price,
      "booked",
      notes,
    ]
  );
  return result.insertId;
};
