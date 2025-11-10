//salons/routes.js
const express = require("express");
const router = express.Router();
const salonController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/", verifyCustomJwt, salonController.createSalon);
router.get("/", verifyCustomJwt, salonController.listActiveSalons);
router.get("/pending", verifyCustomJwt, salonController.listPendingSalons);
router.put(
  "/:salon_id/status",
  verifyCustomJwt,
  salonController.updateSalonStatus
);

module.exports = router;
