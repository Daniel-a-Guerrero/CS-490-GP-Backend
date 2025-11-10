//loyalty/controller.js
const loyaltyService = require("./service");

exports.earnLoyaltyPoints = async (req, res) => {
  try {
    const { salon_id, points_earned } = req.body;
    const user_id = req.user.user_id || req.user.id;

    await loyaltyService.earnLoyaltyPoints(user_id, salon_id, points_earned);
    res.json({ message: "Points added" });
  } catch (err) {
    console.error("Earn points error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getLoyaltyPoints = async (req, res) => {
  try {
    const { user_id, salon_id } = req.params;
    const points = await loyaltyService.getLoyaltyPoints(user_id, salon_id);
    res.json({ points });
  } catch (err) {
    console.error("Get points error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.redeemLoyaltyPoints = async (req, res) => {
  try {
    const { salon_id, points_to_redeem } = req.body;
    const user_id = req.user.user_id || req.user.id;

    await loyaltyService.redeemLoyaltyPoints(user_id, salon_id, points_to_redeem);
    res.json({ message: "Points redeemed" });
  } catch (err) {
    console.error("Redeem error:", err);
    if (err.message === "Not enough points") {
      return res.status(400).json({ error: "Not enough points" });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.setLoyaltyConfig = async (req, res) => {
  try {
    const { salon_id, points_per_visit, redeem_rate } = req.body;
    await loyaltyService.setLoyaltyConfig(salon_id, points_per_visit, redeem_rate);
    res.json({ message: "Config updated" });
  } catch (err) {
    console.error("Config error:", err);
    res.status(500).json({ error: err.message });
  }
};

