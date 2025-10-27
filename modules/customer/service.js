/ customer/model.js
const pool = require('../db'); // make sure db.js exports mysql2/promise pool


// === Get All Customers with optional search and salon filtering ===
exports.getAll = async ({ salon_id, q }) => {
  let sql = `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.phone,
      u.created_at,
      COALESCE(SUM(a.price), 0) AS total_spent,
      COUNT(a.appointment_id) AS total_visits,
      MAX(a.scheduled_time) AS last_visit
    FROM users u
    LEFT JOIN appointments a ON a.user_id = u.user_id
    WHERE u.user_role = 'customer'
  `;


  const params = [];


  if (salon_id) {
    sql += ' AND a.salon_id = ?';
    params.push(salon_id);
  }


  if (q) {
    sql += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }


  sql += `
    GROUP BY u.user_id
    ORDER BY last_visit DESC
  `;


  const [rows] = await pool.query(sql, params);
  return rows;
};


// === Get single customer with details ===
exports.getById = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT
      u.user_id,
      u.full_name,
      u.email,
      u.phone,
      u.created_at,
      COALESCE(SUM(a.price), 0) AS total_spent,
      COUNT(a.appointment_id) AS total_visits,
      MAX(a.scheduled_time) AS last_visit
    FROM users u
    LEFT JOIN appointments a ON a.user_id = u.user_id
    WHERE u.user_id = ? AND u.user_role = 'customer'
    `,
    [id]
  );
  return rows[0];
};


// === Create new customer ===
exports.create = async ({ full_name, email, phone }) => {
  const [result] = await pool.query(
    `
    INSERT INTO users (full_name, email, phone, user_role)
    VALUES (?, ?, ?, 'customer')
    `,
    [full_name, email, phone]
  );
  return { id: result.insertId };
};


// === Update existing customer ===
exports.update = async (id, { full_name, email, phone }) => {
  const fields = [];
  const values = [];


  if (full_name) {
    fields.push('full_name = ?');
    values.push(full_name);
  }
  if (email) {
    fields.push('email = ?');
    values.push(email);
  }
  if (phone) {
    fields.push('phone = ?');
    values.push(phone);
  }


  if (fields.length === 0) return 0;


  const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ? AND user_role = 'customer'`;
  values.push(id);


  const [result] = await pool.query(sql, values);
  return result.affectedRows;
};


// === Delete customer ===
exports.remove = async (id) => {
  const [result] = await pool.query(
    `DELETE FROM users WHERE user_id = ? AND user_role = 'customer'`,
    [id]
  );
  return result.affectedRows;
};
