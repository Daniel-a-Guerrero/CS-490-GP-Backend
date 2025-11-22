//payments/service.js
const { db } = require("../../config/database");
const stripe = require("../../config/stripe");
const { sendEmail } = require("../../services/email");

/**
 * Create Stripe checkout session and send payment link email
 */
exports.createCheckoutAndNotify = async (user_id, amount, appointment_id) => {
  // 1. Get user and appointment details
  const [[user]] = await db.query(
    "SELECT email, full_name FROM users WHERE user_id = ?",
    [user_id]
  );

  const [[appointment]] = await db.query(
    `SELECT a.*, s.salon_name, sv.custom_name as service_name
     FROM appointments a
     JOIN salons s ON a.salon_id = s.salon_id
     JOIN services sv ON a.service_id = sv.service_id
     WHERE a.appointment_id = ?`,
    [appointment_id]
  );

  if (!user || !appointment) {
    throw new Error("User or appointment not found");
  }

  // 2. Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${appointment.salon_name} - ${appointment.service_name}`,
            description: `Appointment on ${new Date(appointment.appointment_date).toLocaleString()}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment-canceled`,
    metadata: {
      appointment_id: appointment_id,
      user_id: user_id,
    },
  });

  // 3. Save payment record
  const [result] = await db.query(
    `INSERT INTO payments
    (user_id, amount, payment_method, payment_status, appointment_id, stripe_checkout_session_id, payment_link)
    VALUES (?, ?, 'stripe', 'pending', ?, ?, ?)`,
    [user_id, amount, appointment_id, session.id, session.url]
  );

  // 4. Send email notification with payment link
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Complete Your Payment</h2>
      <p>Hi ${user.full_name},</p>
      <p>Your appointment has been booked! Please complete your payment to confirm:</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Salon:</strong> ${appointment.salon_name}</p>
        <p><strong>Service:</strong> ${appointment.service_name}</p>
        <p><strong>Date:</strong> ${new Date(appointment.appointment_date).toLocaleString()}</p>
        <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
      </div>

      <a href="${session.url}"
         style="display: inline-block; background: #5469d4; color: white; padding: 14px 28px;
                text-decoration: none; border-radius: 6px; font-weight: bold;">
        Pay Now - $${amount.toFixed(2)}
      </a>

      <p style="color: #666; font-size: 13px; margin-top: 20px;">
        This link expires in 24 hours.
      </p>

      <p>Thank you,<br>${appointment.salon_name}</p>
    </div>
  `;

  await sendEmail(
    user.email,
    `Payment Required - ${appointment.salon_name} Appointment`,
    emailHtml
  );

  return {
    payment_id: result.insertId,
    payment_link: session.url,
    checkout_session_id: session.id,
  };
};

/**
 * Confirm payment (called by webhook)
 */
exports.confirmPayment = async (checkoutSessionId, paymentIntentId) => {
  await db.query(
    `UPDATE payments
    SET payment_status = 'completed', stripe_payment_intent_id = ?
    WHERE stripe_checkout_session_id = ?`,
    [paymentIntentId, checkoutSessionId]
  );

  // Get appointment_id and update appointment status
  const [[payment]] = await db.query(
    "SELECT appointment_id FROM payments WHERE stripe_checkout_session_id = ?",
    [checkoutSessionId]
  );

  if (payment?.appointment_id) {
    await db.query(
      "UPDATE appointments SET status = 'confirmed' WHERE appointment_id = ?",
      [payment.appointment_id]
    );
  }
};

/**
 * Mark payment failed (called by webhook)
 */
exports.failPayment = async (checkoutSessionId, reason) => {
  await db.query(
    `UPDATE payments SET payment_status = 'failed', failure_reason = ?
    WHERE stripe_checkout_session_id = ?`,
    [reason, checkoutSessionId]
  );
};

/**
 * Get payments for a salon
 */
exports.getPaymentsForSalon = async (salon_id) => {
  const [payments] = await db.query(
    `SELECT p.*, u.full_name AS customer_name
     FROM payments p
     LEFT JOIN appointments a ON p.appointment_id = a.appointment_id
     LEFT JOIN users u ON p.user_id = u.user_id
     WHERE a.salon_id = ?`,
    [salon_id]
  );
  return payments || [];
};
