const jwt = require("jsonwebtoken");
const staffPortalService = require("./services");
const staffService = require("../staff/service");

const parsePositiveInt = (value, fallback, max) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (max && num > max) return max;
  return Math.floor(num);
};

exports.login = async (req, res) => {
  try {
    const { staffCode, pin } = req.body;
    if (!staffCode || !pin) {
      return res
        .status(400)
        .json({ error: "staffCode and pin are required fields" });
    }

    const verified = await staffService.verifyStaffLogin(staffCode, pin);
    const profile = await staffPortalService.getStaffProfile(
      verified.staff_id
    );

    if (!profile) {
      return res.status(404).json({ error: "Staff profile not found" });
    }

    const token = jwt.sign(
      {
        staff_id: verified.staff_id,
        salon_id: verified.salon_id,
        user_id: verified.user_id,
        role: "staff",
        scope: "staff_portal",
      },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    const dashboard = await staffPortalService.getDashboardSummary(
      verified.staff_id
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      staff: profile,
      dashboard,
    });
  } catch (err) {
    console.error("Staff portal login failed:", err.message);
    return res.status(401).json({ error: err.message || "Invalid login" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    if (!staffId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const profile = await staffPortalService.getStaffProfile(staffId);
    if (!profile) {
      return res.status(404).json({ error: "Staff not found" });
    }

    return res.status(200).json({ staff: profile });
  } catch (err) {
    console.error("Fetch staff profile error:", err);
    res.status(500).json({ error: "Failed to load staff profile" });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    if (!staffId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const summary = await staffPortalService.getDashboardSummary(
      staffId,
      targetDate
    );
    res.status(200).json(summary);
  } catch (err) {
    console.error("Staff dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
};

exports.listAppointments = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    const salonId = req.user?.salon_id;
    if (!staffId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const page = parsePositiveInt(req.query.page, 1);
    const offset = (page - 1) * limit;

    const result = await staffPortalService.listAppointments({
      staffId,
      salonId,
      status: req.query.status,
      date: req.query.date,
      from: req.query.from,
      to: req.query.to,
      range: req.query.range,
      limit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    res.status(200).json({
      data: result.records,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    console.error("List staff appointments error:", err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
};

exports.listSalonAppointments = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    const salonId = req.user?.salon_id;
    if (!staffId || !salonId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const page = parsePositiveInt(req.query.page, 1);
    const offset = (page - 1) * limit;
    const targetStaffId = req.query.staff_id
      ? parsePositiveInt(req.query.staff_id, null)
      : null;

    const result = await staffPortalService.listSalonAppointments({
      salonId,
      targetStaffId,
      status: req.query.status,
      date: req.query.date,
      from: req.query.from,
      to: req.query.to,
      range: req.query.range,
      limit,
      offset,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / limit));

    res.status(200).json({
      data: result.records,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (err) {
    console.error("List salon appointments error:", err);
    res.status(500).json({ error: "Failed to fetch salon appointments" });
  }
};

exports.getAppointment = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    const salonId = req.user?.salon_id;
    if (!staffId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const appointmentId = Number(req.params.id);
    if (!appointmentId) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const appointment = await staffPortalService.getAppointmentDetails(
      staffId,
      appointmentId,
      salonId
    );

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.status(200).json({ appointment });
  } catch (err) {
    console.error("Get staff appointment error:", err);
    res.status(500).json({ error: "Failed to load appointment" });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    const salonId = req.user?.salon_id;
    if (!staffId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const appointmentId = Number(req.params.id);
    if (!appointmentId) {
      return res.status(400).json({ error: "Invalid appointment id" });
    }

    const { status, notes } = req.body;
    if (!status) {
      return res.status(400).json({ error: "status field is required" });
    }

    const updated = await staffPortalService.updateAppointmentStatus(
      staffId,
      salonId,
      appointmentId,
      status,
      notes
    );

    if (!updated) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.status(200).json({
      message: "Appointment updated",
      appointment: updated,
    });
  } catch (err) {
    if (err.code === "INVALID_STATUS") {
      return res.status(400).json({ error: err.message });
    }
    if (err.code === "FORBIDDEN") {
      return res.status(403).json({ error: "Cannot modify this appointment" });
    }
    console.error("Update staff appointment status error:", err);
    res.status(500).json({ error: "Failed to update appointment" });
  }
};

exports.listCustomers = async (req, res) => {
  try {
    const staffId = req.user?.staff_id;
    const salonId = req.user?.salon_id;
    if (!staffId || !salonId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const scope = req.query.scope === "salon" ? "salon" : "staff";
    const limit = parsePositiveInt(req.query.limit, 6, 20);
    const customers = await staffPortalService.listTopCustomers({
      salonId,
      staffId,
      scope,
      limit,
    });

    res.status(200).json({ customers });
  } catch (err) {
    console.error("List staff portal customers error:", err);
    res.status(500).json({ error: "Failed to fetch customer data" });
  }
};

exports.listRetail = async (req, res) => {
  try {
    const salonId = req.user?.salon_id;
    if (!salonId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const limit = parsePositiveInt(req.query.limit, 4, 12);
    const products = await staffPortalService.listRetailHighlights({
      salonId,
      limit,
    });

    res.status(200).json({ products });
  } catch (err) {
    console.error("List staff portal retail error:", err);
    res.status(500).json({ error: "Failed to fetch retail data" });
  }
};

exports.listTeam = async (req, res) => {
  try {
    const salonId = req.user?.salon_id;
    if (!salonId) {
      return res.status(401).json({ error: "Staff context missing" });
    }

    const limit = parsePositiveInt(req.query.limit, 3, 10);
    const team = await staffPortalService.listTeamMembers({ salonId, limit });

    res.status(200).json({ team });
  } catch (err) {
    console.error("List staff portal team error:", err);
    res.status(500).json({ error: "Failed to fetch team data" });
  }
};
