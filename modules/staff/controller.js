//staff/controllers.js
const staffService = require("./service");

exports.getStaffCount=async (req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const total=await staffService.totalStaff(s_id)
        return res.status(200).json({total})
    }
    catch(err){
    console.error("Total error:", err);
    res.status(500).json({ err: "Server error getting total" });}
}
exports.getStaffAvgRev=async (req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const avg=await staffService.staffReviews(s_id)
        return res.status(200).json({avgRating: avg})
    }
    catch(err){
    console.error("Average error:", err);
    res.status(500).json({ err: "Server error getting total" });}
}
exports.getStaff=async (req,res)=>{
    try{
        const s_id=Number(req.params.sid);
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const q=req.query||{}
        const staff=await staffService.staffFiltered(s_id,q)
        return res.status(200).json({staff})
    }
    catch(err){console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });}
}
exports.getStaffEfficiency=async (req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const id=Number(req.params.id);
        if (!id) return res.status(400).json({ error: "Invalid staff id" });
        const staffEfficiency=await staffService.staffEfficiency(id,s_id)
        return res.status(200).json({efficiency:staffEfficiency})
    }
    catch(err){console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });}
}
exports.getAvgEfficiency=async(req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const aEfficiency=await staffService.averageEfficiency(s_id)
        return res.status(200).json({avgEfficiency:aEfficiency})
    }
    catch(err){console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });}
}
exports.getStaffRevenue=async (req,res)=>{
    try{
        const id=req.params.id
        if (!id) return res.status(400).json({ error: "Invalid staff id" });
        const filters = {};
        if (req.query.startDate) filters.startDate = req.query.startDate;
        if (req.query.endDate) filters.endDate = req.query.endDate;
        const staffRev=await staffService.staffRevenue(id, filters)
        return res.status(200).json({revenue:staffRev})
    }
    catch(err){console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });}
}
exports.addStaff=async (req,res)=>{
    try{
        const {salon_id, user_id, role, specialization}=req.body
        if (!salon_id || !user_id) {
            return res.status(400).json({ error: "salon_id and user_id required" });
        }
        const makeStaff=await staffService.addStaff(salon_id, user_id, role, specialization)
        return res.status(201).json({ created: makeStaff });
    }
    catch(err){console.error("Create staff error:", err);
    res.status(500).json({ err: "Server error making staff" });}
}
exports.editStaff=async (req,res)=>{
    try{
        const { id } = req.params;
        const staff_id = Number(id);
        if (!staff_id) return res.status(400).json({ error: "Invalid staff id" });
        const {salon_id, user_id, role, specialization} = req.body;
        const editedStaff=await staffService.editStaff(id, salon_id, user_id, role, specialization)
        return res.status(200).json({editedStaff})
    }
    catch(err){console.error("Edit staff error:", err);
    res.status(500).json({ err: "Server error editing staff" });}
}