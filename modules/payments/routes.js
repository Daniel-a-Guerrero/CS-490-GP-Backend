//payments/routes.js
const express = require("express");
const router = express.Router();
const paymentController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/pay", verifyCustomJwt, paymentController.processPayment);
router.get(
  "/salon/:salon_id",
  verifyCustomJwt,
  paymentController.getPaymentsForSalon
);

module.exports = router;

