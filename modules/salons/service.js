//salons/service.js
const { db } = require("../../config/database");

exports.createSalon = async ({ ownerId, name, address, description }) => {
  const [result] = await db.query(
    `INSERT INTO salons (owner_id, name, address, description, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [ownerId, name, address, description]
  );
  // create salon_settings default row
  await db.query('INSERT INTO salon_settings (salon_id) VALUES (?)', [result.insertId]);
  // add salon_audit
  await db.query('INSERT INTO salon_audit (salon_id, event_type, event_note, performed_by) VALUES (?, ?, ?, ?)', 
    [result.insertId, 'CREATED', 'Salon registered by owner', ownerId]
  );
  const [rows] = await db.query('SELECT * FROM salons WHERE salon_id = ?', [result.insertId]);
  return rows[0];
};

exports.getSalons = async ({ q, page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  let sql = 'SELECT s.*, u.full_name as owner_name FROM salons s JOIN users u ON u.user_id = s.owner_id WHERE s.status = "active"';
  const params = [];
  if (q) {
    sql += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const [rows] = await db.query(sql, params);
  return rows;
};
