const express = require("express");
const router = express.Router();
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const salonController = require("./controller");

router.get("/", verifyAnyToken, salonController.getAllSalons);
router.get(
  "/:salonId/staff",
  verifyAnyToken,
  salonController.getStaffBySalonId
);
router.get(
  "/staff/schedule",
  verifyAnyToken,
  salonController.getDailySchedule
);
router.get(
  "/user/visit-history",
  verifyAnyToken,
  salonController.getUserVisitHistory
);

// Route for services (supports cookie or Bearer token)
router.get(
  "/:salon_id/services",
  verifyAnyToken,
  salonController.getSalonServices
);

module.exports = router;
