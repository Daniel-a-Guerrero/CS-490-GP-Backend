const { db } = require("../../config/database");

/**
 * Create a new user, optionally linking staff to a salon
 */
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

/**
 * Get all users
 */
async function getAllUsers() {
  const [rows] = await db.query(
    "SELECT user_id, full_name, email, phone, user_role, created_at, updated_at FROM users ORDER BY created_at DESC"
  );
  return rows;
}

/**
 * Get all customers
 */
async function getCustomers() {
  const [rows] = await db.query(
    "SELECT user_id, full_name, email FROM users WHERE user_role = 'customer' ORDER BY full_name ASC"
  );
  return rows;
}

/**
 * Get all customers linked to a specific salon
 */
async function getSalonCustomers(salonId) {
  const [rows] = await db.query(
    `SELECT DISTINCT u.user_id, u.full_name, u.email, u.phone, sc.joined_at
     FROM salon_customers sc
     JOIN users u ON sc.user_id = u.user_id
     WHERE sc.salon_id = ?
     ORDER BY sc.joined_at DESC`,
    [salonId]
  );
  return rows;
}

/**
 * Get a single user by ID
 */
async function getUserById(id) {
  const [rows] = await db.query("SELECT * FROM users WHERE user_id = ?", [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update user details
 */
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

/**
 * Delete a user
 */
async function deleteUser(id) {
  const [result] = await db.query("DELETE FROM users WHERE user_id = ?", [id]);
  return result.affectedRows;
}

module.exports = {
  createUser,
  getAllUsers,
  getCustomers,
  getSalonCustomers,
  getUserById,
  updateUser,
  deleteUser,
};
