const express = require('express');
const router = express.Router();
const appointmentController = require('./controller');
const { verifyFirebaseToken } = require('../../middleware/firebaseAuth');

router.post('/', verifyFirebaseToken, appointmentController.createAppointment);
router.get('/', verifyFirebaseToken, appointmentController.getUserAppointments);
router.get('/:id', verifyFirebaseToken, appointmentController.getAppointmentById);
router.put('/:id', verifyFirebaseToken, appointmentController.updateAppointment);
router.delete('/:id', verifyFirebaseToken, appointmentController.cancelAppointment);

module.exports = router;
