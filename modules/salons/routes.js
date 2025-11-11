const express = require("express");
const router = express.Router();
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const salonController = require("./controller");

// Always define specific routes BEFORE dynamic ones
router.get(
  "/:salon_id/services",
  verifyAnyToken,
  salonController.getSalonServices
);

router.get("/", verifyAnyToken, salonController.getAllSalons);
router.get("/check-owner", verifyAnyToken, salonController.checkOwnerSalon);
router.get(
  "/:salonId/staff",
  verifyAnyToken,
  salonController.getStaffBySalonId
);
router.get("/staff/schedule", verifyAnyToken, salonController.getDailySchedule);
router.get(
  "/user/visit-history",
  verifyAnyToken,
  salonController.getUserVisitHistory
);

module.exports = router;
