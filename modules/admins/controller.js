//admins/controller.js
const adminService = require("./service");

exports.getUserEngagement = async (req, res) => {
  try {
    const stats = await adminService.getUserEngagement();
    res.json(stats);
  } catch (err) {
    console.error("Engagement error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAppointmentTrends = async (req, res) => {
  try {
    const trends = await adminService.getAppointmentTrends();
    res.json(trends);
  } catch (err) {
    console.error("Trends error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSalonRevenues = async (req, res) => {
  try {
    const revenues = await adminService.getSalonRevenues();
    res.json(revenues);
  } catch (err) {
    console.error("Revenues error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLoyaltyUsage = async (req, res) => {
  try {
    const usage = await adminService.getLoyaltyUsage();
    res.json(usage);
  } catch (err) {
    console.error("Loyalty error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getUserDemographics = async (req, res) => {
  try {
    const demographics = await adminService.getUserDemographics();
    res.json(demographics);
  } catch (err) {
    console.error("Demographics error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerRetention = async (req, res) => {
  try {
    const retention = await adminService.getCustomerRetention();
    res.json(retention);
  } catch (err) {
    console.error("Retention error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const reports = await adminService.getReports();
    res.json(reports);
  } catch (err) {
    console.error("Reports error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSystemLogs = async (req, res) => {
  try {
    const logs = await adminService.getSystemLogs();
    res.json(logs);
  } catch (err) {
    console.error("Logs error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.verifyReg = async(req, res) => {
  try{
    const {sid} = req.params.sid
    const {status}=req.body.approved.toLowerCase()||'approved'  //by default assumes approving
    console.log(sid);
    const affected = await adminService.updateSalonReg(sid, status)
    res.status(200).json(affected);
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: err.message });
  }
}