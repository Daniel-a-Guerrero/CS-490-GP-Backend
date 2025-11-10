//appointments/routes.js
const express = require("express");
const router = express.Router();
const appointmentController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/", verifyCustomJwt, appointmentController.bookAppointment);

module.exports = router;
