//bookings/routes.js
const express = require("express");
const router = express.Router();
const bookingController = require("./controller");
const { authenticateUser } = require("../../middleware/firebaseAuth");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

// Customers: Get available barbers and calculated time slots
router.get(
  "/available",
  verifyCustomJwt,
  bookingController.getAvailableBarbersAndSlots
);

// Book appointment (Customer)
router.post("/book", verifyCustomJwt, bookingController.bookAppointment);

// Reschedule appointment (Customer)
router.put(
  "/reschedule/:id",
  verifyCustomJwt,
  bookingController.rescheduleAppointment
);

// Cancel appointment (Customer)
router.delete(
  "/cancel/:id",
  verifyCustomJwt,
  bookingController.cancelAppointment
);

// Barber: Get daily schedule
router.get(
  "/barber/schedule",
  verifyCustomJwt,
  bookingController.getBarberSchedule
);

// Barber: Block time off (unavailable slots)
router.post(
  "/barber/block-slot",
  verifyCustomJwt,
  bookingController.blockTimeSlot
);

module.exports = router;

