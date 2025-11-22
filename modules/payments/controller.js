//payments/controller.js
const paymentService = require("./service");

/**
 * Create checkout session and send payment email
 */
exports.createCheckout = async (req, res) => {
  try {
    const { amount, appointment_id } = req.body;
    const user_id = req.user.user_id || req.user.id || req.user.userId;

    if (!user_id) {
      return res.status(400).json({ error: "User ID not found in token" });
    }

    if (!amount || !appointment_id) {
      return res.status(400).json({ error: "Amount and appointment_id required" });
    }

    const result = await paymentService.createCheckoutAndNotify(
      user_id,
      parseFloat(amount),
      appointment_id
    );

    res.json({
      success: true,
      message: "Payment link sent to your email",
      payment_id: result.payment_id,
      payment_link: result.payment_link,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get payments for a salon
 */
exports.getPaymentsForSalon = async (req, res) => {
  try {
    const { salon_id } = req.params;
    const payments = await paymentService.getPaymentsForSalon(salon_id);
    res.json({ payments });
  } catch (err) {
    console.error("Get payments error:", err);
    res.status(500).json({ error: err.message });
  }
};
