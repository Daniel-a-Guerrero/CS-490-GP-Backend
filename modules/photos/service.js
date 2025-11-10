//photos/service.js
const { db } = require("../../config/database");

exports.addServicePhoto = async (appointment_id, user_id, staff_id, service_id, photo_type, photo_url) => {
  const [result] = await db.query(
    `INSERT INTO service_photos (appointment_id, user_id, staff_id, service_id, photo_type, photo_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      appointment_id,
      user_id,
      staff_id || null,
      service_id || null,
      photo_type,
      photo_url,
    ]
  );
  return result.insertId;
};

exports.getServicePhotos = async (appointment_id) => {
  const [photos] = await db.query(
    `SELECT * FROM service_photos WHERE appointment_id = ?`,
    [appointment_id]
  );
  return photos;
};

