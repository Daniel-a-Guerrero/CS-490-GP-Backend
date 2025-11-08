const express = require("express");
const router = express.Router();
const appointmentController = require("./controller");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");

router.post("/", verifyAnyToken, appointmentController.createAppointment);
router.get("/", verifyAnyToken, appointmentController.getUserAppointments);
router.get("/:id", verifyAnyToken, appointmentController.getAppointmentById);
router.put("/:id", verifyAnyToken, appointmentController.updateAppointment);
router.delete("/:id", verifyAnyToken, appointmentController.cancelAppointment);

module.exports = router;
