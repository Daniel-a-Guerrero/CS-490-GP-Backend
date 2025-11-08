const appointmentService = require("./service");

const createAppointment = async (req, res) => {
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
    let userId = req.user.id;
    const role = req.user.role;

    if (!salonId || !serviceId || !scheduledTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // If staff or owner adding appointment for someone else
    if (role === "staff" || role === "owner") {
      const [existing] = await db.query(
        "SELECT user_id FROM users WHERE email = ? OR phone = ? LIMIT 1",
        [customerEmail, customerPhone]
      );

      if (existing.length) {
        userId = existing[0].user_id;
      } else {
        const [result] = await db.query(
          "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, 'customer')",
          [customerName || "New Customer", customerPhone, customerEmail]
        );
        userId = result.insertId;
      }
    }

    const appointmentId = await appointmentService.createAppointment(
      userId,
      salonId,
      staffId,
      serviceId,
      scheduledTime,
      price || 0,
      notes
    );

    await db.query(
      "INSERT IGNORE INTO salon_customers (salon_id, user_id) VALUES (?, ?)",
      [salonId, userId]
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

const getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const appointments = await appointmentService.getAppointmentsByUser(userId);
    res.json(appointments);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get appointments" });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await appointmentService.getAppointmentById(id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json(appointment);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get appointment" });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;

    const affectedRows = await appointmentService.updateAppointment(
      id,
      updates
    );

    if (affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ message: "Appointment updated" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const id = req.params.id;

    const affectedRows = await appointmentService.cancelAppointment(id);

    if (affectedRows === 0) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ message: "Appointment cancelled" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

module.exports = {
  createAppointment,
  getUserAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
};
