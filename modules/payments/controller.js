//payments/controller.js
const paymentService = require("./service");

exports.processPayment = async (req, res) => {
  try {
    const { amount, payment_method, appointment_id } = req.body;
    // Try different ways to get user_id from token
    const user_id = req.user.user_id || req.user.id || req.user.userId;

    if (!user_id) {
      console.error("User ID not found in token. Token payload:", req.user);
      return res.status(400).json({ error: "User ID not found in token" });
    }

    const payment_id = await paymentService.processPayment(user_id, amount, payment_method, appointment_id);
    if (!payment_id) {
      return res.status(404).json({ error: "Not found" });
    }
    res.json({ message: "Payment processed", payment_id });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ error: err.message });
  }
};

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

