const pool = require('../../config/database');

async function createSalon({ ownerId, name, address, description }) {
  const [result] = await pool.query(
    `INSERT INTO salons (owner_id, name, address, description, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [ownerId, name, address, description]
  );
  // create salon_settings default row
  await pool.query('INSERT INTO salon_settings (salon_id) VALUES (?)', [result.insertId]);
  // add salon_audit
  await pool.query('INSERT INTO salon_audit (salon_id, event_type, event_note, performed_by) VALUES (?, ?, ?, ?)', 
    [result.insertId, 'CREATED', 'Salon registered by owner', ownerId]
  );
  const [rows] = await pool.query('SELECT * FROM salons WHERE salon_id = ?', [result.insertId]);
  return rows[0];
}

async function allSalons(page = 1, limit = 10 ) {
  const offset = (page - 1) * limit;
  let sql = `SELECT s.*, u.full_name as owner_name 
            FROM salons s 
            JOIN users u ON u.user_id = s.owner_id 
              WHERE s.status = "active" 
            ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  const params = [];
  /*if (q) {
    sql += ' AND (s.name LIKE ? OR s.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }*/
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function freeSalons(days){
  const query=`
  select sa.day_of_week, s.* 
  from staff s
  right join staff_availability sa on s.staff_id=sa.staff_id`
  const result = await db.query(query);
  const filtered = result.rows.filter(row => {
      const dayKey = row.day_of_week.toLowerCase().substring(0, 2);
      return days[dayKey] === 1;
    });
    
    return filtered;
}
async function dailySched(s_id) {
  const query = `select sa.day_of_week, s*
  from staff s
  right join staff_availability sa on s.staff_id=sa.staff_id
  where s.staff_id=?`
  const result = await db.query(query, [s_id])
  return result
}
async function staffFiltered(uid) {
  const query=`select * from history h where user_id=?`
  const result=await db.query(query,[uid])
  return result
}
async function verSalon(s_id){
  const query=`UPDATE salons s
  SET s.status='active'
  WHERE salon_id=?`
  const result=await db.query(query, [s_id])
}

module.exports = { createSalon, allSalons, freeSalons, dailySched, staffFiltered, verSalon };
