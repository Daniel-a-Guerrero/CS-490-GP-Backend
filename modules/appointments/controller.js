//appointments/controller.js
const appointmentService = require("./service");

exports.bookAppointment = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    const { salon_id, staff_id, service_id, scheduled_time, price, notes } = req.body;

    const appointment_id = await appointmentService.bookAppointment(
      user_id,
      salon_id,
      staff_id,
      service_id,
      scheduled_time,
      price,
      notes
    );

    res.status(201).json({
      appointment_id,
      message: "Appointment booked",
    });
  } catch (err) {
    console.error("Book appointment error:", err);
    res.status(500).json({ error: err.message });
  }
};
