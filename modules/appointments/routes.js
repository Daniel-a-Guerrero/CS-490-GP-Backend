const express = require("express");
const router = express.Router();
const appointmentController = require("./controller");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const checkRoles = require("../../middleware/checkRoles");

// ✅ Create new appointment (supports auto-assign staff)
router.post(
  "/create",
  verifyAnyToken,
  checkRoles("customer", "staff", "owner"),
  appointmentController.createAppointment
);

router.get(
  "/salon",
  verifyAnyToken,
  checkRoles("owner", "staff", "admin"),
  appointmentController.getAppointmentsBySalon
);

router.get(
  "/",
  verifyAnyToken,
  checkRoles("customer"),
  appointmentController.getUserAppointments
);

router.get(
  "/:id",
  verifyAnyToken,
  checkRoles("customer", "staff", "owner"),
  appointmentController.getAppointmentById
);

router.put(
  "/:id",
  verifyAnyToken,
  checkRoles("staff", "owner"),
  appointmentController.updateAppointment
);

router.delete(
  "/:id",
  verifyAnyToken,
  checkRoles("customer", "staff", "owner"),
  appointmentController.cancelAppointment
);

module.exports = router;
