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