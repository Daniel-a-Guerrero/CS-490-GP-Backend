//salon/controllers.js
const salonService = require("./service");

exports.getAllSalons=async (req,res)=>{
    try{
        const page=Number(req.params.page)
        const limit=Number(req.params.limit)
        const total=await salonService.allSalons(page, limit)
        return res.status(200).json({data:total})
    }
    catch(err){
    console.error("Total error:", err);
    res.status(500).json({ err: "Server error getting total" });}
}
exports.getFreeDays=async(req,res)=>{
    /**
     * Format of req.body.days:
     * days{
     *  mo: true,
     *  tu: false,
     *  we:
     *  th:
     *  fr:
     *  sa:
     *  su:
     * ...  etc.
     * }
     */
    try{
        const {freeDays}=req.body;
        if(!freeDays){
            return res.status(400).json({err:"Days list missing"})
        }
        const days=await salonService.freeSalons(days)
    }
    catch(err){
    console.error("Total error:", err);
    res.status(500).json({ err: "Server error getting free days" });}
}
exports.getDailySchedule=async (req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid staff id" });
        const schedule=await salonService.dailySched(s_id)
        return res.status(200).json({data: schedule})
    }
    catch(err){
    console.error("Staff Schedule error:", err);
    res.status(500).json({ err: "Server error getting schedule" });}
}
exports.getUserHistory=async (req,res)=>{
    try{
        const u_id=Number(req.params.uid);
        if (!iid) return res.status(400).json({ error: "Invalid user id" });
        const history=await salonService.staffFiltered(uid)
        return res.status(200).json({history})
    }
    catch(err){console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });}
}
exports.verifySalon=async (req,res)=>{
    try{
        const s_id=Number(req.params.sID)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const salonVerified=await salonService.verSalon(s_id)
        return res.status(200).json({verified:salonVerified})
    }
    catch(err){console.error("Verifying salon error:", err);
    res.status(500).json({ err: "Server error verifying salon" });}
}




exports.getAvgEfficiency=async(req,res)=>{
    try{
        const s_id=Number(req.query.salonId)
        if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
        const aEfficiency=await salonService.averageEfficiency(s_id)
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
        const staffRev=await salonService.staffRevenue(id, filters)
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
        const makeStaff=await salonService.addStaff(salon_id, user_id, role, specialization)
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
        const editedStaff=await salonService.editStaff(id, salon_id, user_id, role, specialization)
        return res.status(200).json({editedStaff})
    }
    catch(err){console.error("Edit staff error:", err);
    res.status(500).json({ err: "Server error editing staff" });}
}