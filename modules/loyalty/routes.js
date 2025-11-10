//loyalty/routes.js
const express = require("express");
const router = express.Router();
const loyaltyController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/earn", verifyCustomJwt, loyaltyController.earnLoyaltyPoints);
router.get(
  "/:user_id/:salon_id",
  verifyCustomJwt,
  loyaltyController.getLoyaltyPoints
);
router.post(
  "/redeem",
  verifyCustomJwt,
  loyaltyController.redeemLoyaltyPoints
);
router.post("/config", verifyCustomJwt, loyaltyController.setLoyaltyConfig);

module.exports = router;

