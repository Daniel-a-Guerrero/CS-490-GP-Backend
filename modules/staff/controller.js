// modules/staff/controller.js
const staffService = require("./service");
const { sendEmail } = require("../../services/email");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/* -------------------------------------------------------------------------- */
/*   ANALYTICS CONTROLLERS  */
/* -------------------------------------------------------------------------- */

exports.getStaffCount = async (req, res) => {
  try {
    const s_id = Number(req.query.salonId);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const total = await staffService.totalStaff(s_id);
    return res.status(200).json({ total });
  } catch (err) {
    console.error("Total error:", err);
    res.status(500).json({ err: "Server error getting total" });
  }
};

exports.getStaffAvgRev = async (req, res) => {
  try {
    const s_id = Number(req.query.salonId);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const avg = await staffService.staffReviews(s_id);
    return res.status(200).json({ avgRating: avg });
  } catch (err) {
    console.error("Average error:", err);
    res.status(500).json({ err: "Server error getting average" });
  }
};

exports.getStaff = async (req, res) => {
  try {
    const s_id = Number(req.params.sid);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const q = req.query || {};
    const staff = await staffService.staffFiltered(s_id, q);
    return res.status(200).json({ staff });
  } catch (err) {
    console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });
  }
};

exports.getStaffEfficiency = async (req, res) => {
  try {
    const s_id = Number(req.query.salonId);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid staff id" });
    const staffEfficiency = await staffService.staffEfficiency(id, s_id);
    return res.status(200).json({ efficiency: staffEfficiency });
  } catch (err) {
    console.error("Fetching staff efficiency error:", err);
    res.status(500).json({ err: "Server error getting efficiency" });
  }
};

exports.getAvgEfficiency = async (req, res) => {
  try {
    const s_id = Number(req.query.salonId);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const aEfficiency = await staffService.averageEfficiency(s_id);
    return res.status(200).json({ avgEfficiency: aEfficiency });
  } catch (err) {
    console.error("Fetching avg efficiency error:", err);
    res.status(500).json({ err: "Server error getting avg efficiency" });
  }
};

exports.getStaffRevenue = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "Invalid staff id" });
    const filters = {};
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    const staffRev = await staffService.staffRevenue(id, filters);
    return res.status(200).json({ revenue: staffRev });
  } catch (err) {
    console.error("Fetching staff revenue error:", err);
    res.status(500).json({ err: "Server error getting staff revenue" });
  }
};

/* -------------------------------------------------------------------------- */
/*  👥 STAFF MANAGEMENT (OWNER ONLY)  */
/* -------------------------------------------------------------------------- */

exports.addStaff = async (req, res) => {
  try {
    const { salon_id, user_id, role, specialization, email } = req.body;
    if (!salon_id || !user_id)
      return res.status(400).json({ error: "salon_id and user_id required" });

    const makeStaff = await staffService.addStaff(
      salon_id,
      user_id,
      role,
      specialization
    );

    // Generate PIN setup email
    const token = crypto.randomBytes(32).toString("hex");
    await staffService.savePinSetupToken(makeStaff.insertId, token);

    const setupLink = `${process.env.FRONTEND_URL}/salon/${salon_id}/staff/set-pin?token=${token}`;
    const loginLink = `${process.env.FRONTEND_URL}/salon/${salon_id}/staff`;

    await sendEmail(
      email,
      "Welcome to StyGo Staff Portal",
      `
      <h2>Welcome to the team!</h2>
      <p>Your staff account has been created for <b>Salon #${salon_id}</b>.</p>
      <p>To set your 4–6 digit PIN, click below:</p>
      <a href="${setupLink}" style="background:#00BFA6;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;">Set My PIN</a>
      <p>Once set, you can log in anytime at:</p>
      <p><a href="${loginLink}">${loginLink}</a></p>
      `
    );

    return res.status(201).json({ created: makeStaff });
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(500).json({ err: "Server error making staff" });
  }
};

exports.editStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff_id = Number(id);
    if (!staff_id) return res.status(400).json({ error: "Invalid staff id" });

    const { salon_id, user_id, role, specialization } = req.body;
    const editedStaff = await staffService.editStaff(
      id,
      salon_id,
      user_id,
      role,
      specialization
    );
    return res.status(200).json({ editedStaff });
  } catch (err) {
    console.error("Edit staff error:", err);
    res.status(500).json({ err: "Server error editing staff" });
  }
};

/* -------------------------------------------------------------------------- */
/*  🔐 STAFF PORTAL AUTH (PIN LOGIN FLOW)  */
/* -------------------------------------------------------------------------- */

// Step 1: Staff sets a PIN using token
exports.setStaffPin = async (req, res) => {
  try {
    const { token, pin } = req.body;
    if (!token || !pin)
      return res.status(400).json({ error: "Missing token or PIN" });

    const updated = await staffService.setStaffPin(token, pin);
    if (!updated)
      return res.status(400).json({ error: "Invalid or expired token" });

    res.status(200).json({ message: "PIN set successfully" });
  } catch (err) {
    console.error("Set PIN error:", err);
    res.status(500).json({ error: "Server error setting PIN" });
  }
};

// Step 2: Staff logs in using staff_id + pin
exports.staffLogin = async (req, res) => {
  try {
    const { staff_id, pin } = req.body;
    if (!staff_id || !pin)
      return res.status(400).json({ error: "Missing staff_id or PIN" });

    const token = await staffService.verifyStaffLogin(staff_id, pin);
    if (!token) return res.status(401).json({ error: "Invalid credentials" });

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("Staff login error:", err);
    res.status(500).json({ error: "Server error logging in" });
  }
};
