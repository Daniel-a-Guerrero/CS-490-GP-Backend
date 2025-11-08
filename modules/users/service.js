const { db } = require("../../config/database");

async function createUser(
  full_name,
  phone,
  email,
  role = "customer",
  salon_id = null
) {
  const [userResult] = await db.query(
    "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, ?)",
    [full_name, phone, email, role]
  );

  const userId = userResult.insertId;

  if (role === "staff" && salon_id) {
    await db.query(
      "INSERT INTO staff (user_id, salon_id, active) VALUES (?, ?, 1)",
      [userId, salon_id]
    );
  }

  return userId;
}

async function getAllUsers() {
  const [rows] = await db.query(
    "SELECT user_id, full_name, email, phone, user_role, created_at, updated_at FROM users ORDER BY created_at DESC"
  );
  return rows;
}

async function getCustomers() {
  const [rows] = await db.query(
    "SELECT user_id, full_name, email FROM users WHERE user_role = 'customer' ORDER BY full_name ASC"
  );
  return rows;
}

async function getUserById(id) {
  const [rows] = await db.query("SELECT * FROM users WHERE user_id = ?", [id]);
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

  const [result] = await db.query(sql, values);
  return result.affectedRows;
}

async function deleteUser(id) {
  const [result] = await db.query("DELETE FROM users WHERE user_id = ?", [id]);
  return result.affectedRows;
}

module.exports = {
  createUser,
  getAllUsers,
  getCustomers,
  getUserById,
  updateUser,
  deleteUser,
};
