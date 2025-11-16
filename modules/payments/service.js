const Stripe = require("stripe");
const { query } = require("../../config/database");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createCheckoutSession({ amount, currency, customerEmail }) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: "Salon Service Payment" },
          unit_amount: amount, // in cents
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/cancel`,
  });

  return session.url;
}

async function recordPayment({ sessionId, amount, currency, email, status }) {
  const sql = `
    INSERT INTO payments (session_id, amount, currency, email, status)
    VALUES (?, ?, ?, ?, ?)
  `;
  await query(sql, [sessionId, amount, currency, email, status]);
}

module.exports = { createCheckoutSession, recordPayment };
