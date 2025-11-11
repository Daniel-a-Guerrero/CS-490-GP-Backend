const pool = require("../../config/database");

async function createSalon({ ownerId, name, address, description, phone, city, email, website, profile_picture }) {
  const [result] = await db.query(
    `INSERT INTO salons (owner_id, name, address, description, phone, email, website, profile_picture, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [ownerId, name, address, description, phone || null, email || null, website || null, profile_picture || null]
  );
  // create salon_settings default row
  await pool.query("INSERT INTO salon_settings (salon_id) VALUES (?)", [
    result.insertId,
  ]);
  // add salon_audit
  await pool.query(
    "INSERT INTO salon_audit (salon_id, event_type, event_note, performed_by) VALUES (?, ?, ?, ?)",
    [result.insertId, "CREATED", "Salon registered by owner", ownerId]
  );
  
  // Auto-seed default staff roles for new salon
  const defaultRoles = [
    { role_name: "Manager", permissions: JSON.stringify({ canManageStaff: true, canViewReports: true, canManageServices: true }) },
    { role_name: "Stylist", permissions: JSON.stringify({ canViewSchedule: true, canManageOwnAppointments: true }) },
    { role_name: "Receptionist", permissions: JSON.stringify({ canViewSchedule: true, canManageAppointments: true }) },
  ];
  
  for (const role of defaultRoles) {
    await pool.query(
      "INSERT INTO staff_roles (salon_id, role_name, permissions) VALUES (?, ?, ?)",
      [result.insertId, role.role_name, role.permissions]
    );
  }
  
  const [rows] = await pool.query("SELECT * FROM salons WHERE salon_id = ?", [
    result.insertId,
  ]);
  return rows[0];
}

async function getSalons({ q, page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  let sql =
    'SELECT s.*, u.full_name as owner_name FROM salons s JOIN users u ON u.user_id = s.owner_id WHERE s.status = "active"';
  const params = [];
  if (q) {
    sql += " AND (s.name LIKE ? OR s.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = { createSalon, getSalons };
