//staff/service.js
const { db } = require("../../config/database");

exports.totalStaff=async ()=>{
    const [rows]=await db.query(`SELECT COUNT(staff_id) as total FROM staff`)
    return rows.length ? rows[0].total : 0;
}
exports.staffReviews=async()=>{
    const [rows]=await db.query(`SELECT AVG(rating,2) as avgRating 
                                FROM reviews WHERE staff_id IS NOT NULL`)
    return rows.length?rows[0].avgRating:0
}
exports.staffFiltered=async(queries={})=>{
        const sqlS=`SELECT st.staff_id, 
                    u.full_name, u.phone, u.email, 
                    st.specialization, st.is_active, 
                    COALESCE(AVG(r.rating), 0) AS avg_rating 
                    FROM staff st 
                    JOIN users u ON u.user_id=st.user_id
                    LEFT JOIN reviews r ON r.staff_id=st.staff_id
                    WHERE 1=1 `
        const params=[]
            if(queries.name){
                params.push(`%${queries.name}%`)
                sqlS+=` AND u.full_name LIKE ? `
            }
              if (typeof queries.is_active !== "undefined") {
                const val =
                  queries.is_active === "true" || queries.is_active === true ? 1 : 0;
                sqlS += ` AND st.is_active = ? `;
                params.push(val);
            }
                if (queries.specialty) {
                sqlS += ` AND st.specialization LIKE ? `;
                params.push(`%${queries.specialty}%`);
            }
            sqlS += ` GROUP BY st.staff_id `;
            if (queries.rating) {
                sqlS += ` HAVING AVG(r.rating) >= ? `;
                params.push(Number(queries.rating));
            }
            if(queries.order){
                if(queries.order==="name"){
                    sqlS+=` ORDER BY u.full_name `
                }
                else if(queries.order==="rating"){
                    sqlS+=` ORDER BY avg_rating `
                }
                if(queries.aOrD && queries.aOrD.toLowerCase()==="d"){
                    sqlS+=` DESC `
                }else {sql += ` ASC `;}
            }
  // Pagination
  const limit = parseInt(queries.limit, 10) || 50;
  const page = Math.max(parseInt(queries.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  sql += ` LIMIT ? OFFSET ? `;
  params.push(limit, offset);

  const [rows] = await db.query(sql, params);
  return rows; // return array of staff objects (possibly empty)
}
exports.staffEfficiency=async (id)=>{
    const [rows]=await db.query(`SELECT
       s.staff_id,
       u.full_name,
       COALESCE(SUM(svc.duration),0) AS total_service_minutes,
       COALESCE(SUM(TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time)),0) AS total_available_minutes,
       ROUND(
         COALESCE(SUM(svc.duration),0) / NULLIF(COALESCE(SUM(TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time)),0),0) * 100,
         2
       ) AS efficiency_percentage
     FROM staff s
     JOIN users u ON s.user_id = u.user_id
     LEFT JOIN staff_availability sa ON s.staff_id = sa.staff_id
     LEFT JOIN appointments a ON s.staff_id = a.staff_id AND a.status = 'completed'
     LEFT JOIN services svc ON a.service_id = svc.service_id
     WHERE s.staff_id = ?
     GROUP BY s.staff_id
`,[id])
  if (!rows || rows.length === 0) {
    return {
      staff_id: id,
      total_service_minutes: 0,
      total_available_minutes: 0,
      efficiency_percentage: 0,
    };
  }
const r= rows[0]
return {
    staff_id: r.staff_id,
    full_name: r.full_name,
    total_service_minutes: Number(r.total_service_minutes) || 0,
    total_available_minutes: Number(r.total_available_minutes) || 0,
    efficiency_percentage: Number(r.efficiency_percentage) || 0,
  };
}
exports.staffRevenue=async(id, filters={})=>{
    let sq=`SELECT
        s.staff_id, u.full_name, COALESCE(SUM(p.amount), 0) as total_revenue, COUNT(DISTINCT a.appointment_id) AS appointments_count 
        FROM staff s
        LEFT JOIN appointments a on a.staff_id=s.staff_id 
        LEFT JOIN payments p on p.appointment_id=a.appointment_id
        WHERE s.staff_id=?
          AND a.status = 'completed'
          AND p.payment_status = 'completed'`;
    const params=[id]
        if (filters.startDate) {
        sq += ` AND a.scheduled_time >= ?`;
        params.push(filters.startDate);
    }
    if (filters.endDate) {
        sq += ` AND a.scheduled_time <= ?`;
        params.push(filters.endDate);
    }
sq += ` GROUP BY s.staff_id `;
const [rows] = await db.query(sql, params);
  if (!rows || rows.length === 0) {
    return { staff_id: id, total_revenue: 0, appointments_count: 0 };
  }
  return rows[0];
}
exports.addStaff=async(salon, user, role, specialization)=>{
    const [result]=await db.query(`INSERT INTO
        staff
        (salon_id, user_ud, role, specialization)
        VALUES (?, ?, ?, ?)`,[salon, user, role, specialization]);
        return {insertId: result.insertId, affectedRows: result.affectedRows,};

};
exports.editStaff=async(staff_id, salon_id, user_id, role, specialization)=>{
    const [result] = await db.query(
            `UPDATE staff s
             SET s.salon_id = ?, s.user_id = ?, s.role = ?, s.specialization = ?
             WHERE c.customer_id = ?`,
            [staff_id, salon_id, user_id, role, specialization]
        );
        return {
    affectedRows: result.affectedRows,
    changedRows: result.changedRows,
  };
}