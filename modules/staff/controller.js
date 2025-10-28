//staff/controllers.js
const staffService = require("./service");

exports.getStaffCount=(req,res)=>{
    try{
        const t=staffService.totalStaff()
        if(t==="empty"){return res.status(204).json({ error: "Empty database" });}
        return res.status(200).json({total:`${t}`})
    }
    catch{
    console.error("Total error:", err);
    res.status(500).json({ error: "Server error getting total" });}
}
exports.getStaffAvgRev=(req,res)=>{
    try{
        const t=staffService.staffReviews()
        if(t==="empty"){return res.status(204).json({ error: "Empty database" });}
        return res.status(200).json({total:`${t}`})
    }
    catch{
    console.error("Average error:", err);
    res.status(500).json({ error: "Server error getting total" });}
}
exports.getStaff=(req,res)=>{
    try{
        const q=req.query
        const staff=staffService.staffFiltered(q)
        if(t==="empty"){return res.status(204).json({ error: "Empty database" });}
        return res.status(200).json({staff:staff})
    }
    catch{console.error("Fetching staff error:", err);
    res.status(500).json({ error: "Server error getting staff" });}
}
exports.getStaffEfficiency=(req,res)=>{
    try{
        const id=req.params.id
        const staffEfficiency=staffService.staffEfficiency(id)
        return res.status(200).json({efficiency:staffEfficiency})
    }
    catch{console.error("Fetching staff error:", err);
    res.status(500).json({ error: "Server error getting staff" });}
}
exports.getStaffRevenue=(req,res)=>{
    try{
        const id=req.params.id
        const staffRev=staffService.staffRevenue(id)
        return res.status(200).json({revenue:staffRev})
    }
    catch{console.error("Fetching staff error:", err);
    res.status(500).json({ error: "Server error getting staff" });}
}
exports.addStaff=(req,res)=>{
    try{
        const {salon_id, user_id, role, specialization}=req.body
        const makeStaff=staffService.addStaff(salon_id, user_id, role, specialization)
    }
    catch{console.error("Create staff error:", err);
    res.status(500).json({ error: "Server error making staff" });}
}
exports.editStaff=(req,res)=>{
    try{
        const { id } = req.params;
        const {salon_id, user_id, role, specialization} = req.body;
        const editedStaff=staffService.editStaff(id, salon_id, user_id, role, specialization)
        return res.status(200).json({makeStaff})
    }
    catch{console.error("Edit staff error:", err);
    res.status(500).json({ error: "Server error editing staff" });}
}