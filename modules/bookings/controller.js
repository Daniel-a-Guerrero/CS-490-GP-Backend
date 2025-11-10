//bookings/controller.js
const bookingService = require("./service");

exports.getAvailableBarbersAndSlots = async (req, res) => {
  try {
    const barbers = await bookingService.getAvailableBarbersAndSlots();
    res.json({ barbers });
  } catch (err) {
    console.error("Get available barbers error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { staff_id, salon_id, service_id, scheduled_time } = req.body;
    // Try different ways to get user_id from token
    const user_id = req.user?.user_id || req.user?.id || req.user?.userId;

    if (!user_id) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const available = await bookingService.checkSlotAvailability(staff_id, scheduled_time);

    if (!available) {
      return res.status(400).json({ error: "Time slot not available" });
    }

    const appointment_id = await bookingService.bookAppointment(
      user_id,
      salon_id,
      staff_id,
      service_id,
      scheduled_time
    );

    if (!appointment_id) {
      return res.status(500).json({ error: "Failed to create appointment" });
    }

    res.json({ message: "Appointment booked", appointment_id });
  } catch (err) {
    console.error("Book appointment error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.rescheduleAppointment = async (req, res) => {
  try {
    const appointment_id = req.params.id;
    const { new_scheduled_time } = req.body;

    const appt = await bookingService.getAppointmentById(appointment_id);
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const available = await bookingService.checkRescheduleAvailability(
      appt.staff_id,
      new_scheduled_time,
      appointment_id
    );

    if (!available) {
      return res.status(400).json({ error: "Time slot not available" });
    }

    await bookingService.rescheduleAppointment(appointment_id, new_scheduled_time);
    res.json({ message: "Appointment rescheduled" });
  } catch (err) {
    console.error("Reschedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const appointment_id = req.params.id;
    await bookingService.cancelAppointment(appointment_id);
    res.json({ message: "Appointment cancelled" });
  } catch (err) {
    console.error("Cancel error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBarberSchedule = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    const staff_id = await bookingService.getStaffIdByUserId(user_id);

    if (!staff_id) {
      return res.status(403).json({ error: "Not a staff member" });
    }

    const schedule = await bookingService.getBarberSchedule(staff_id);
    res.json({ schedule });
  } catch (err) {
    console.error("Get schedule error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.blockTimeSlot = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    const { start_datetime, end_datetime, reason } = req.body;

    const staff_id = await bookingService.getStaffIdByUserId(user_id);
    if (!staff_id) {
      return res.status(403).json({ error: "Not a staff member" });
    }

    await bookingService.blockTimeSlot(staff_id, start_datetime, end_datetime, reason);
    res.json({ message: "Time slot blocked" });
  } catch (err) {
    console.error("Block slot error:", err);
    res.status(500).json({ error: err.message });
  }
};

