const appointmentService = require('./service');

const createAppointment = async (req, res) => {
  try {
    const salonId = req.body.salonId;
    const staffId = req.body.staffId;
    const serviceId = req.body.serviceId;
    const scheduledTime = req.body.scheduledTime;
    const price = req.body.price;
    const notes = req.body.notes;
    const userId = req.user.id;
    
    if (!salonId || !serviceId || !scheduledTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const appointmentId = await appointmentService.createAppointment(userId, salonId, staffId, serviceId, scheduledTime, price || 0, notes);
    
    res.status(201).json({ appointmentId: appointmentId });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
};

const getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const appointments = await appointmentService.getAppointmentsByUser(userId);
    res.json(appointments);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get appointments' });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await appointmentService.getAppointmentById(id);
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json(appointment);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get appointment' });
  }
};

const updateAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    
    const affectedRows = await appointmentService.updateAppointment(id, updates);
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json({ message: 'Appointment updated' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    
    const affectedRows = await appointmentService.cancelAppointment(id);
    
    if (affectedRows === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    res.json({ message: 'Appointment cancelled' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
};

module.exports = {
  createAppointment,
  getUserAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment
};
