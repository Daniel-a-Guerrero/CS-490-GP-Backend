const { query, db } = require("../../config/database");
const appointmentService = require("./service");
const { sendEmail } = require("../../services/email");

/**
 * Create Appointment
 * - Customers can book for themselves
 * - Staff/Owners can book on behalf of customers
 * - If no staffId provided, auto-assign the least busy available staff
 */

exports.createAppointment = async (req, res) => {
  try {
    const {
      salonId,
      staffId,
      serviceId,
      services,
      scheduledTime,
      price,
      notes,
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      zip,
    } = req.body;

    const role = req.user.role;
    const tokenSalonId = req.user.salon_id;
    const finalSalonId = salonId || tokenSalonId;

    // alidate either serviceId or services array
    if (
      !finalSalonId ||
      (!serviceId && !Array.isArray(services)) ||
      !scheduledTime ||
      !email ||
      !phone
    ) {
      return res.status(400).json({
        error: "Missing required fields (email, phone, service, time)",
      });
    }

    const [existingCustomer] = await db.query(
      "SELECT user_id, full_name FROM users WHERE email = ? OR phone = ? LIMIT 1",
      [email, phone]
    );

    let userId;
    let customerFullName;

    if (existingCustomer.length) {
      userId = existingCustomer[0].user_id;
      customerFullName = existingCustomer[0].full_name;
    } else {
      const fullName =
        `${firstName || ""} ${lastName || ""}`.trim() || "New Customer";
      const [insert] = await db.query(
        "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, 'customer')",
        [fullName, phone, email]
      );
      userId = insert.insertId;
      customerFullName = fullName;
    }

    await db.query(
      `
      INSERT INTO salon_customers (salon_id, user_id, address, city, state, zip, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        address = VALUES(address),
        city = VALUES(city),
        state = VALUES(state),
        zip = VALUES(zip),
        notes = VALUES(notes)
      `,
      [
        finalSalonId,
        userId,
        address || null,
        city || null,
        state || null,
        zip || null,
        notes || null,
      ]
    );

    let assignedStaffId = staffId;
    if (!assignedStaffId) {
      const [rows] = await db.query(
        `
        SELECT s.staff_id
        FROM staff s
        LEFT JOIN appointments a 
          ON s.staff_id = a.staff_id 
          AND DATE(a.scheduled_time) = CURDATE()
        WHERE s.salon_id = ? AND s.is_active = 1
        GROUP BY s.staff_id
        ORDER BY COUNT(a.appointment_id) ASC
        LIMIT 1;
        `,
        [finalSalonId]
      );

      if (!rows.length) {
        return res
          .status(400)
          .json({ error: "No active staff available for this salon" });
      }

      assignedStaffId = rows[0].staff_id;
    }

    // handle multi or single service gracefully
    const serviceInput =
      Array.isArray(services) && services.length ? services : serviceId;

    const appointmentId = await appointmentService.createAppointment(
      userId,
      finalSalonId,
      assignedStaffId,
      serviceInput,
      scheduledTime,
      price || 0,
      notes
    );

    const [[salonInfo]] = await db.query(
      "SELECT salon_name, address FROM salons WHERE salon_id = ?",
      [finalSalonId]
    );

    // Pick service names from either array or single
    let serviceSummary = "";
    if (Array.isArray(services)) {
      serviceSummary = services
        .map((s) => s.custom_name || `#${s.service_id}`)
        .join(", ");
    } else {
      const [[serviceInfo]] = await db.query(
        "SELECT custom_name, duration FROM services WHERE service_id = ?",
        [serviceId]
      );
      serviceSummary = serviceInfo?.custom_name || "Selected Service";
    }

    const emailHtml = `
      <h2>Appointment Confirmed</h2>
      <p>Dear ${firstName || customerFullName || "Customer"},</p>
      <p>Your appointment at <b>${
        salonInfo?.salon_name || "our salon"
      }</b> is confirmed.</p>
      <ul>
        <li><b>Services:</b> ${serviceSummary}</li>
        <li><b>Time:</b> ${new Date(scheduledTime).toLocaleString()}</li>
        <li><b>Total Price:</b> $${Number(price).toFixed(2)}</li>
      </ul>
      <p><b>Salon Address:</b> ${salonInfo?.address || "N/A"}</p>
      <p>We look forward to seeing you!</p>
    `;

    await sendEmail(email, "Your Appointment is Confirmed!", emailHtml);

    res.status(201).json({
      message: "Appointment created successfully",
      appointmentId,
      assignedStaffId,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ error: "Failed to create appointment" });
  }
};

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

exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const appointment = await appointmentService.getAppointmentById(id);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });
    if (role === "staff" && appointment.salon_id !== req.user.salon_id)
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    if (role === "customer" && appointment.user_id !== req.user.user_id)
      return res.status(403).json({ error: "Access denied" });
    res.json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ error: "Failed to get appointment" });
  }
};

exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const updates = req.body;

    const appointment = await appointmentService.getAppointmentById(id);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });
    if (role === "staff" && appointment.salon_id !== req.user.salon_id)
      return res.status(403).json({ error: "Forbidden: cross-salon access" });

    const updated = await appointmentService.updateAppointment(id, updates);
    if (!updated)
      return res
        .status(404)
        .json({ error: "Appointment not found or unchanged" });

    res.json({ message: "Appointment updated successfully", updated });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ error: "Failed to update appointment" });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const appointment = await appointmentService.getAppointmentById(id);
    if (!appointment)
      return res.status(404).json({ error: "Appointment not found" });
    if (role === "staff" && appointment.salon_id !== req.user.salon_id)
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    if (role === "customer" && appointment.user_id !== req.user.user_id)
      return res
        .status(403)
        .json({ error: "You can only cancel your own appointments" });
    const affectedRows = await appointmentService.cancelAppointment(id);
    if (affectedRows === 0)
      return res.status(404).json({ error: "Appointment not found" });
    res.json({ message: "Appointment cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

exports.getAppointmentsBySalon = async (req, res) => {
  try {
    const role = req.user.role;
    const tokenSalonId = req.user.salon_id;
    const salonId =
      role === "admin"
        ? req.params.salon_id || req.query.salon_id || tokenSalonId
        : tokenSalonId;
    if (!salonId)
      return res
        .status(400)
        .json({ error: "Salon ID missing or not associated with this user" });
    if (role === "staff" && tokenSalonId !== Number(salonId))
      return res.status(403).json({ error: "Forbidden: cross-salon access" });
    const { date, from, to } = req.query;
    const appointments = await appointmentService.getAppointmentsBySalon(
      salonId,
      date,
      from,
      to
    );
    res.status(200).json({ data: appointments });
  } catch (error) {
    console.error("Error fetching salon appointments:", error);
    res.status(500).json({ error: "Failed to fetch salon appointments" });
  }
};
