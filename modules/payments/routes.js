const express = require("express");
const router = express.Router();
const paymentController = require("./controller");

router.post("/create-checkout", paymentController.createCheckout);
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // required by Stripe
  paymentController.handleWebhook
);

module.exports = router;
