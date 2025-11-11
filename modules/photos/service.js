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

// Get all gallery photos for a salon
exports.getSalonGallery = async (salon_id) => {
  const [photos] = await db.query(
    `SELECT photo_id, salon_id, photo_url, caption, uploaded_at 
     FROM salon_photos 
     WHERE salon_id = ? 
     ORDER BY uploaded_at DESC`,
    [salon_id]
  );
  return photos;
};

// Add a photo to salon gallery
exports.addSalonPhoto = async (salon_id, photo_url, caption) => {
  const [result] = await db.query(
    `INSERT INTO salon_photos (salon_id, photo_url, caption) VALUES (?, ?, ?)`,
    [salon_id, photo_url, caption || null]
  );
  return result.insertId;
};

// Delete a photo from gallery
exports.deleteSalonPhoto = async (photo_id) => {
  await db.query(`DELETE FROM salon_photos WHERE photo_id = ?`, [photo_id]);
};

