const { query } = require("../../config/database");
const { db } = require("../../config/database");
const appointmentService = require("./service");

/**
 * Create Appointment
 * - Customers can book for themselves
 * - Staff/Owners can book on behalf of customers
 */
exports.createAppointment = async (req, res) => {
  try {
    const {
      salonId,
      staffId,
      serviceId,
      scheduledTime,
      price,
      notes,
      customerEmail,
      customerPhone,
      customerName,
    } = req.body;

    let userId = req.user.user_id;
    const role = req.user.role;
    const tokenSalonId = req.user.salon_id;

    // Prefer salonId from token if not provided in body
    const finalSalonId = salonId || tokenSalonId;

    if (!finalSalonId || !serviceId || !scheduledTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ FIXED: Staff/Owner booking for another customer
    if (role === "staff" || role === "owner") {
      const existing = await query(
        "SELECT user_id FROM users WHERE email = ? OR phone = ? LIMIT 1",
        [customerEmail, customerPhone]
      );

      if (existing.length) {
        userId = existing[0].user_id;
      } else {
        const result = await query(
          "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, 'customer')",
          [customerName || "New Customer", customerPhone, customerEmail]
        );
        userId = result.insertId;
      }
    }

    const appointmentId = await appointmentService.createAppointment(
      userId,
      finalSalonId,
      staffId,
      serviceId,
      scheduledTime,
      price || 0,
      notes
    );

    // Link customer to salon if not already linked
    await query(
      "INSERT IGNORE INTO salon_customers (salon_id, user_id) VALUES (?, ?)",
      [finalSalonId, userId]
    );

    res.status(201).json({
      message: "Appointment created successfully",
      appointmentId,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
};

/**
 * Get appointments for the logged-in user
 */
exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const appointments = await appointmentService.getAppointmentsByUser(userId);
    res.json({ data: appointments });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ error: "Failed to get appointments" });
  }
};

/**
 * Get appointment by ID
 */
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const appointment = await appointmentService.getAppointmentById(id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Role-based access control
    if (role === "staff" && appointment.salon_id !== req.user.salon_id) {
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    }

    if (role === "customer" && appointment.user_id !== req.user.user_id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ error: "Failed to get appointment" });
  }
};

/**
 * Update Appointment
 */
exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const updates = req.body;

    const appointment = await appointmentService.getAppointmentById(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (role === "staff" && appointment.salon_id !== req.user.salon_id) {
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    }

    const affectedRows = await appointmentService.updateAppointment(
      id,
      updates
    );
    if (affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ message: "Appointment updated successfully" });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
};

/**
 * Cancel Appointment
 */
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;

    const appointment = await appointmentService.getAppointmentById(id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (role === "staff" && appointment.salon_id !== req.user.salon_id) {
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    }

    if (role === "customer" && appointment.user_id !== req.user.user_id) {
      return res
        .status(403)
        .json({ error: "You can only cancel your own appointments" });
    }

    const affectedRows = await appointmentService.cancelAppointment(id);
    if (affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ message: "Appointment cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

/**
 * Get appointments by salon (Owner/Admin/Staff)
 * Automatically uses req.user.salon_id for owner/staff.
 * Admins can use ?salon_id= or /:salon_id.
 * Supports optional filters:
 *  - ?date=YYYY-MM-DD
 *  - ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
exports.getAppointmentsBySalon = async (req, res) => {
  try {
    const role = req.user.role;
    const tokenSalonId = req.user.salon_id;

    const salonId =
      role === "admin"
        ? req.params.salon_id || req.query.salon_id || tokenSalonId
        : tokenSalonId;

    if (!salonId) {
      return res
        .status(400)
        .json({ error: "Salon ID missing or not associated with this user" });
    }

    if (role === "staff" && tokenSalonId !== Number(salonId)) {
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    }

    const { date, from, to } = req.query;

    const appointments = await appointmentService.getAppointmentsBySalon(
      salonId,
      date,
      from,
      to
    );

    console.log("DEBUG:", { salonId, date, count: appointments.length });

    if (!appointments || appointments.length === 0) {
      console.log(
        `No appointments found for salon_id=${salonId} on date=${date}`
      );
      return res.status(200).json({ data: [] });
    }

    return res.status(200).json({ data: appointments });
  } catch (error) {
    console.error("Error fetching salon appointments:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch salon appointments" });
  }
};
