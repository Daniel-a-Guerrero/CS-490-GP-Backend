const express = require("express");
const router = express.Router();
const verifyAnyTokens = require("../../middleware/verifyAnyTokens");
const salonController = require("./controller");

router.get("/", verifyAnyTokens, salonController.getAllSalons);
router.get(
  "/:salonId/staff",
  verifyAnyTokens,
  salonController.getStaffBySalonId
);
router.get(
  "/staff/schedule",
  verifyAnyTokens,
  salonController.getDailySchedule
);
router.get(
  "/user/visit-history",
  verifyAnyTokens,
  salonController.getUserVisitHistory
);

// Route for services (supports cookie or Bearer token)
router.get(
  "/:salon_id/services",
  verifyAnyTokens,
  salonController.getSalonServices
);

module.exports = router;
