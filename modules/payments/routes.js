//payments/routes.js
const express = require("express");
const router = express.Router();
const paymentController = require("./controller");
const webhookController = require("./webhooks");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");

// Create checkout and send payment email (authenticated)
router.post("/checkout", verifyAnyToken, paymentController.createCheckout);

// Get salon payments (authenticated)
router.get("/salon/:salon_id", verifyAnyToken, paymentController.getPaymentsForSalon);

// Stripe webhook (no auth, raw body handled in app.js)
router.post("/webhook", webhookController.handleWebhook);

module.exports = router;
