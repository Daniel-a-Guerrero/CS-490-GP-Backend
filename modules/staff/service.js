const { db } = require("../../config/database");

exports.totalStaff=async ()=>{
    const [rows]=await db.query(`SELECT COUNT(staff_id) as total FROM staff`)
    if(rows.length===0){
        return "empty"
    }
    return rows[0].total
}
exports.staffReviews=async()=>{
    const [rows]=await db.query(`SELECT AVG(rating) as avgRating FROM reviews WHERE staff_id IS NOT NULL`)
    if(rows.length===0){
        return "empty"
    }
    return rows[0].avgRating
}
exports.staffFiltered=async(queries)=>{
        const sqlS=`SELECT st.*, u.full_name, u.phone, u.email, r.rating FROM staff st 
                    JOIN users u ON u.user_id=st.user_id
                    JOIN reviews r ON r.staff_id=st.staff_id
                    WHERE 1=1 `
        var searcher=[]
        if(queries.length!==0){
            if(queries.rating){
                searcher.push=queries.rating
                sqlS+=` AND r.rating > ? `
            }
            if(queries.name){
                searcher.push=queries.name
                sqlS+=` AND u.full_name=? `
            }
            if(queries.order){
                if(queries.order==="name"){
                    sqlS+=` ORDER BY st.full_name `
                }
                else if(queries.order==="rating"){
                    sqlS+=` ORDER BY r.rating `
                }
                if(queries.aOrD=="d"){
                    sqlS+=` DESC `
                }
            }
        }
        const [rows]=await db.query(sqlS)
        if(rows.length===0){
        return "empty"
    }
    return rows[0]
}
exports.staffEfficiency=async (id)=>{
    const [rows]=await db.query(`SELECT 
    s.staff_id,
    u.full_name,
    SEC_TO_TIME(SUM(ap.duration) * 60) AS total_service_time,
    SEC_TO_TIME(SUM(
        TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time)
    ) * 60) AS total_available_time,
    ROUND( (SUM(ap.duration) / SUM(TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time))) * 100, 2 ) AS efficiency_percentage
FROM staff s
JOIN users u ON s.user_id = u.user_id
LEFT JOIN staff_availability sa ON s.staff_id = sa.staff_id
LEFT JOIN appointments a ON s.staff_id = a.staff_id AND a.status = 'completed'
LEFT JOIN services ap ON a.service_id = ap.service_id
WHERE s.staff_id = ?
GROUP BY s.staff_id;
`,[id])
return rows[0]
}
exports.staffRevenue=async(id)=>{
    const [rows]=await db.query(`SELECT
        s.staff_id, COALESCE(SUM(p.amount), 0) as IND_REVENUE FROM staff s
        LEFT JOIN appointments a on a.staff_id=s.staff_id 
        LEFT JOIN payments p on p.appointment_id=a.appointment_id
        WHERE s.staff_id=?
          AND a.status = 'completed'
          AND p.payment_status = 'completed'
        GROUP BY s.staff_id`,[id]);
        return rows[0]
}
exports.addStaff=async(salon, user, role, specialization)=>{
    const [rows]=await db.query(`INSERT INTO
        staff
        (salon_id, user_ud, role, specialization)
        VALUES (?, ?, ?, ?)`,[salon, user, role, specialization]);
        return rows[0]
}