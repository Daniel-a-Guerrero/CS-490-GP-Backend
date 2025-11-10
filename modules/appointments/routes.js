const express = require("express");
const router = express.Router();
const appointmentController = require("./controller");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const checkRoles = require("../../middleware/checkRoles");

// Create new appointment
router.post(
  "/",
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

// Get all appointments for logged-in user
router.get(
  "/",
  verifyAnyToken,
  checkRoles("customer"),
  appointmentController.getUserAppointments
);

// Get appointment by ID
router.get(
  "/:id",
  verifyAnyToken,
  checkRoles("customer", "staff", "owner"),
  appointmentController.getAppointmentById
);

// Update appointment
router.put(
  "/:id",
  verifyAnyToken,
  checkRoles("staff", "owner"),
  appointmentController.updateAppointment
);

// Cancel appointment
router.delete(
  "/:id",
  verifyAnyToken,
  checkRoles("customer", "staff", "owner"),
  appointmentController.cancelAppointment
);

module.exports = router;
