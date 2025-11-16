const paymentService = require("./service");
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckout = async (req, res) => {
  try {
    const { amount, currency, email } = req.body;
    if (!amount || !currency || !email) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const checkoutUrl = await paymentService.createCheckoutSession({
      amount,
      currency,
      customerEmail: email,
    });

    res.json({ url: checkoutUrl });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// Webhook endpoint
const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    await paymentService.recordPayment({
      sessionId: session.id,
      amount: session.amount_total,
      currency: session.currency,
      email: session.customer_email,
      status: session.payment_status,
    });
  }

  res.json({ received: true });
};

module.exports = { createCheckout, handleWebhook };
