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
  return result
}
async function salonApp(s_id){
  const query=`SELECT
    COUNT(CASE WHEN a.scheduled_time >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND a.scheduled_time < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 END) AS previous_month_count,
    COUNT(CASE WHEN a.scheduled_time >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 END) AS current_month_count
FROM appointments AS a
WHERE a.salon_id = ?
AND a.scheduled_time >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH);`
  const result=await db.query(query, [s_id])
  const { previous_month_count, current_month_count} = result;
  const percentChange=previous_month_count===0?100:
    (((current_month_count-previous_month_count)/previous_month_count)*100)
  return {current_month_count, previous_month_count, percentChange}  
}
async function salonRev(s_id) {
  const query=`SELECT
    SUM(
        CASE 
            WHEN MONTH(p.created_at) = MONTH(CURRENT_DATE()) 
                 AND YEAR(p.created_at) = YEAR(CURRENT_DATE()) 
            THEN amount 
            ELSE 0 
        END
    ) AS current_month_revenue,
    SUM(
        CASE 
            WHEN MONTH(p.created_at) = MONTH(CURRENT_DATE() - INTERVAL 1 MONTH) 
                 AND YEAR(p.created_at) = YEAR(CURRENT_DATE() - INTERVAL 1 MONTH) 
            THEN amount 
            ELSE 0 
        END
    ) AS last_month_revenue
FROM
    payments p
join appointments a on p.appointment_id=a.appointment_id
join salons s on s.salon_id=a.salon_id
where s.salon_id=?;`
  const [result]=await db.query(query, [s_id])
  const { current_month_revenue, last_month_revenue } = result;
  const percentChange=last_month_revenue===0?100:
    (((current_month_revenue-last_month_revenue)/last_month_revenue)*100)
  return {current_month_revenue, last_month_revenue, percentChange}  
}
async function newCust(s_id){
  const query=`SELECT
    COUNT(DISTINCT CASE WHEN u.created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
               AND u.created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN u.user_id END) AS previous_month_count,
    COUNT(DISTINCT CASE WHEN u.created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN u.user_id END) AS current_month_count
FROM
    users AS u
JOIN
    appointments a ON u.user_id = a.user_id
WHERE
    a.salon_id = ?
    AND u.created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH);
`
  const result=await db.query(query, [s_id])
  const { previous_month_count, current_month_count} = result;
  const percentChange=previous_month_count===0?100:
    (((current_month_count-previous_month_count)/previous_month_count)*100)
  return {current_month_count, previous_month_count, percentChange}  
}
async function avgRating(s_id){
  const query=`SELECT AVG(CASE WHEN a.created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH) AND a.created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN a.rating END) AS previous_month_avg,
    AVG(CASE WHEN a.created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN a.rating END) AS current_month_avg
FROM reviews AS a WHERE a.salon_id = ?
AND a.created_at >= DATE_SUB(DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01'), INTERVAL 1 MONTH);`
  const result=await db.query(query, [s_id])
  const { previous_month_avg, current_month_avg} = result;
  const percentChange=previous_month_avg===0?100:
    (((current_month_avg-previous_month_avg)/previous_month_avg)*100)
  return {current_month_avg, previous_month_avg, percentChange}  
}
async function apptToday(s_id){
  const query=`select a.* 
from appointments a
where DATE(a.scheduled_time)=CURDATE()
and a.salon_id=?`
  const result=await db.query(query, [s_id])
  const { previous_month_avg, current_month_avg} = result;
  const percentChange=previous_month_avg===0?100:
    (((current_month_avg-previous_month_avg)/previous_month_avg)*100)
  return {current_month_avg, previous_month_avg, percentChange}  
}
module.exports = { createSalon, allSalons, freeSalons,
   dailySched, staffFiltered, verSalon, salonRev,salonApp };
