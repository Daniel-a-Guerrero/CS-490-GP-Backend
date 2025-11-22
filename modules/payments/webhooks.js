//payments/webhooks.js
const stripe = require("../../config/stripe");
const paymentService = require("./service");

exports.handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Stripe webhook: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        await paymentService.confirmPayment(session.id, session.payment_intent);
        console.log(`Payment confirmed for session ${session.id}`);
        break;

      case "checkout.session.expired":
        const expired = event.data.object;
        await paymentService.failPayment(expired.id, "Session expired");
        break;
    }
  } catch (err) {
    console.error("Webhook processing error:", err);
  }

  res.json({ received: true });
};
