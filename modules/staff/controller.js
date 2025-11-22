// modules/staff/controller.js
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { db } = require("../../config/database");
const staffService = require("./service");
const { sendEmail } = require("../../services/email");

// ------------------------ STAFF SUMMARY ------------------------

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
    res.status(500).json({ err: "Server error getting average rating" });
  }
};

exports.getStaff = async (req, res) => {
  try {
    const s_id = Number(req.params.id);
    if (!s_id) return res.status(400).json({ error: "Invalid salon id" });
    const q = req.query || {};
    const staff = await staffService.staffFiltered(s_id, q);
    return res.status(200).json({ staff });
  } catch (err) {
    console.error("Fetching staff error:", err);
    res.status(500).json({ err: "Server error getting staff" });
  }
};

// ------------------------ STAFF METRICS ------------------------

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
    console.error("Fetching average efficiency error:", err);
    res.status(500).json({ err: "Server error getting average efficiency" });
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
    res.status(500).json({ err: "Server error getting revenue" });
  }
};

// ------------------------ ADD STAFF + ONBOARDING ------------------------

exports.addStaff = async (req, res) => {
  try {
    const {
      salon_id,
      salon_slug,
      staff_role,
      staff_role_id,
      specialization,
      email,
      full_name,
      phone,
    } = req.body;

    if (!salon_id || !email || !salon_slug) {
      return res.status(400).json({
        error: "salon_id, email, and salon_slug are required",
      });
    }

    // Step 1: Find or create user
    const [existingUser] = await db.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    let user_id;
    if (existingUser.length > 0) {
      user_id = existingUser[0].user_id;
    } else {
      const [result] = await db.query(
        "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, 'staff')",
        [full_name, phone, email]
      );
      user_id = result.insertId;
    }

    // Step 2: Create staff record + unique staff code
    const newStaff = await staffService.addStaff(
      salon_id,
      user_id,
      staff_role,
      staff_role_id,
      specialization
    );
    const { insertId, staffCode } = newStaff;

    // Step 3: Generate PIN setup token
    const token = crypto.randomBytes(32).toString("hex");
    await staffService.savePinSetupToken(insertId, token);

    // Step 4: Build URLs
    const frontendBase = process.env.FRONTEND_URL;
    const setupLink = `${frontendBase}/salon/${salon_slug}/staff/sign-in-code?token=${token}`;
    const loginLink = `${frontendBase}/salon/${salon_slug}/staff/login`;

    // Step 5: Send onboarding email
    const emailHtml = `
      <h2>Welcome to StyGo Staff Portal!</h2>
      <p>Hello ${full_name.split(" ")[0]},</p>
      <p>You’ve been added as a staff member at <b>${salon_slug}</b>.</p>
      <p>Your 4-digit Staff ID: <b>${staffCode}</b></p>
      <p>Please set your personal PIN to activate your account:</p>
      <a href="${setupLink}" 
         style="display:inline-block;padding:10px 20px;background:#10B981;color:white;
                border-radius:6px;text-decoration:none;margin-top:10px;">Set Your PIN</a>
      <p>Once your PIN is set, log in anytime here:<br/>
        <a href="${loginLink}" style="color:#10B981;">${loginLink}</a>
      </p>
      <br/>
      <p>Thanks,<br/>The StyGo Team</p>
    `;

    // Send email in background (don't wait for it)
    sendEmail(email, "Set Up Your StyGo Staff PIN", emailHtml)
      .then(() => console.log("✅ Onboarding email sent successfully"))
      .catch((emailErr) =>
        console.log("⚠️ Email sending failed:", emailErr.message)
      );

    // Return immediately without waiting for email
    return res.status(201).json({
      message: "Staff created successfully",
      staff_id: insertId,
      staff_code: staffCode,
      email_sent: true,
    });
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(500).json({ err: "Server error creating staff" });
  }
};

// ------------------------ EDIT STAFF ------------------------

exports.editStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff_id = Number(id);
    if (!staff_id) return res.status(400).json({ error: "Invalid staff id" });

    const {
      salon_id,
      user_id,
      staff_role,
      staff_role_id,
      specialization,
      full_name,
      phone,
      email,
    } = req.body;

    // Fetch current user_id if not provided
    let finalUserId = user_id;
    if (!finalUserId) {
      const [existing] = await db.query(
        "SELECT user_id FROM staff WHERE staff_id = ?",
        [staff_id]
      );
      if (existing.length > 0) finalUserId = existing[0].user_id;
    }

    // Call updated service (updates both staff + user)
    await staffService.editStaff(
      staff_id,
      salon_id,
      finalUserId,
      staff_role,
      staff_role_id,
      specialization,
      full_name,
      phone,
      email
    );

    return res.status(200).json({
      message: "Staff updated successfully",
      updated: {
        staff_id,
        staff_role,
        specialization,
        full_name,
        phone,
        email,
      },
    });
  } catch (err) {
    console.error("Edit staff error:", err);
    res.status(500).json({ err: "Server error editing staff" });
  }
};

// ------------------------ STAFF ROLE MANAGEMENT ------------------------

exports.getStaffRoles = async (req, res) => {
  try {
    const salon_id = Number(req.query.salon_id);
    if (!salon_id) return res.status(400).json({ error: "Missing salon_id" });

    const [rows] = await db.query(
      "SELECT staff_role_id, staff_role_name FROM staff_roles WHERE salon_id = ?",
      [salon_id]
    );

    res.status(200).json({ roles: rows });
  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({ error: "Server error fetching roles" });
  }
};

exports.addStaffRole = async (req, res) => {
  try {
    const { salon_id, staff_role_name } = req.body;
    if (!salon_id || !staff_role_name)
      return res.status(400).json({ error: "Missing salon_id or role name" });

    const [result] = await db.query(
      "INSERT INTO staff_roles (salon_id, staff_role_name) VALUES (?, ?)",
      [salon_id, staff_role_name]
    );

    res.status(201).json({
      role: {
        staff_role_id: result.insertId,
        staff_role_name,
      },
    });
  } catch (err) {
    console.error("Error adding staff role:", err);
    res.status(500).json({ error: "Server error adding role" });
  }
};

// ------------------------ PIN + LOGIN ------------------------

exports.setStaffPin = async (req, res) => {
  try {
    const { token, pin } = req.body;
    if (!token || !pin)
      return res.status(400).json({ error: "Missing token or PIN" });
    const result = await staffService.setStaffPin(token, pin);
    res.status(200).json(result);
  } catch (err) {
    console.error("Set staff PIN error:", err);
    res.status(500).json({ err: err.message || "Failed to set PIN" });
  }
};

exports.verifyStaffLogin = async (req, res) => {
  try {
    const { staffCode, pin } = req.body;
    if (!staffCode || !pin)
      return res.status(400).json({ error: "Missing staffCode or PIN" });
    const result = await staffService.verifyStaffLogin(staffCode, pin);
    res.status(200).json({ message: "Login successful", ...result });
  } catch (err) {
    console.error("Verify staff login error:", err);
    res.status(401).json({ error: err.message || "Invalid credentials" });
  }
};

// ------------------------ DELETE STAFF ------------------------

exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const staff_id = Number(id);
    if (!staff_id) return res.status(400).json({ error: "Invalid staff id" });

    // Optional: for soft delete instead of removing
    // await db.query(`UPDATE staff SET is_active = 0 WHERE staff_id = ?`, [staff_id]);

    const [result] = await db.query(`DELETE FROM staff WHERE staff_id = ?`, [
      staff_id,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Staff not found" });

    res.status(200).json({ message: "Staff deleted successfully" });
  } catch (err) {
    console.error("Delete staff error:", err);
    res.status(500).json({ error: "Server error deleting staff" });
  }
};

exports.getStaffBySalon = async (req, res) => {
  try {
    const salonId = req.params.id;
    console.log("Incoming staff fetch for salon:", salonId);

    const staff = await staffService.getStaffBySalon(salonId);
    console.log("Staff returned:", staff.length, "records");

    return res.status(200).json({ staff });
  } catch (err) {
    console.error(" Error fetching staff:", err);
    res.status(500).json({ error: "Server error fetching staff" });
  }
};
