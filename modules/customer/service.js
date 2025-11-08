const { query } = require("../../config/database");

async function createUser(user) {
  const sql = `
    INSERT INTO users (firebase_uid, full_name, phone, email, profile_pic, user_role)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [
    user.firebase_uid || null,
    user.full_name,
    user.phone || null,
    user.email,
    user.profile_pic || null,
    user.user_role,
  ];
  const result = await query(sql, values);
  return result.insertId;
}

async function getAllUsers() {
  const sql = `SELECT user_id, firebase_uid, full_name, phone, email, profile_pic, user_role, created_at, updated_at FROM users ORDER BY created_at DESC`;
  const users = await query(sql);
  return users;
}

async function getUserById(id) {
  const sql = `SELECT * FROM users WHERE user_id = ?`;
  const rows = await query(sql, [id]);
  return rows.length > 0 ? rows[0] : null;
}

async function getUserByEmail(email) {
  const sql = `SELECT * FROM users WHERE email = ?`;
  const rows = await query(sql, [email]);
  return rows.length > 0 ? rows[0] : null;
}

async function updateUser(id, updates) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return 0;
  const sql = `UPDATE users SET ${fields.join(
    ", "
  )}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
  values.push(id);

  const result = await query(sql, values);
  return result.affectedRows;
}

async function deleteUser(id) {
  const sql = `DELETE FROM users WHERE user_id = ?`;
  const result = await query(sql, [id]);
  return result.affectedRows;
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
};
