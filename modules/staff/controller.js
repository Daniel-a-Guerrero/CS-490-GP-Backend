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