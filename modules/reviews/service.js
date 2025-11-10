//reviews/service.js
const { db } = require("../../config/database");

exports.addReview = async (appointment_id, user_id, salon_id, staff_id, rating, comment) => {
  const [result] = await db.query(
    `INSERT INTO reviews (appointment_id, user_id, salon_id, staff_id, rating, comment, is_visible, is_flagged)
     VALUES (?, ?, ?, ?, ?, ?, TRUE, FALSE)`,
    [appointment_id, user_id, salon_id, staff_id, rating, comment]
  );
  return result.insertId;
};

exports.addReviewResponse = async (review_id, response) => {
  await db.query(`UPDATE reviews SET response = ? WHERE review_id = ?`, [
    response,
    review_id,
  ]);
};

