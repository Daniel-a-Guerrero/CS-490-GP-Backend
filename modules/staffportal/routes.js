const express = require("express");
const router = express.Router();
const staffPortalController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const checkRoles = require("../../middleware/checkRoles");

router.post("/login", staffPortalController.login);

router.use(verifyCustomJwt, checkRoles("staff"));

router.get("/me", staffPortalController.getProfile);
router.get("/dashboard", staffPortalController.getDashboard);
router.get("/appointments", staffPortalController.listAppointments);
router.get(
  "/salon/appointments",
  staffPortalController.listSalonAppointments
);
router.get("/appointments/:id", staffPortalController.getAppointment);
router.patch(
  "/appointments/:id/status",
  staffPortalController.updateAppointmentStatus
);
router.get("/customers", staffPortalController.listCustomers);
router.get("/retail", staffPortalController.listRetail);
router.get("/team", staffPortalController.listTeam);

module.exports = router;
