//loyalty/service.js
const { db } = require("../../config/database");

exports.getLoyaltyRecord = async (user_id, salon_id) => {
  const [rows] = await db.query(
    `SELECT * FROM loyalty WHERE user_id = ? AND salon_id = ?`,
    [user_id, salon_id]
  );
  return rows[0];
};

exports.earnLoyaltyPoints = async (user_id, salon_id, points_earned) => {
  const loyalty = await this.getLoyaltyRecord(user_id, salon_id);
  
  if (loyalty) {
    await db.query(
      `UPDATE loyalty SET points = points + ?, last_earned = NOW(), updated_at = NOW() WHERE loyalty_id = ?`,
      [points_earned, loyalty.loyalty_id]
    );
  } else {
    await db.query(
      `INSERT INTO loyalty (user_id, salon_id, points, last_earned) VALUES (?, ?, ?, NOW())`,
      [user_id, salon_id, points_earned]
    );
  }
};

exports.getLoyaltyPoints = async (user_id, salon_id) => {
  const [rows] = await db.query(
    `SELECT points FROM loyalty WHERE user_id = ? AND salon_id = ?`,
    [user_id, salon_id]
  );
  if (rows[0]) {
    return rows[0].points || 0;
  }
  return 0;
};

exports.redeemLoyaltyPoints = async (user_id, salon_id, points_to_redeem) => {
  const loyalty = await this.getLoyaltyRecord(user_id, salon_id);
  
  if (!loyalty || loyalty.points < points_to_redeem) {
    throw new Error("Not enough points");
  }
  
  await db.query(
    `UPDATE loyalty SET points = points - ?, last_redeemed = NOW(), updated_at = NOW() WHERE user_id = ? AND salon_id = ?`,
    [points_to_redeem, user_id, salon_id]
  );
};

exports.setLoyaltyConfig = async (salon_id, points_per_visit, redeem_rate) => {
  const configData = { points_per_visit: points_per_visit, redeem_rate: redeem_rate };
  const configString = JSON.stringify(configData);
  const policyValue = 'loyalty:' + configString;
  
  await db.query(
    `INSERT INTO salon_settings (salon_id, cancellation_policy, auto_complete_after)
     VALUES (?, ?, 120)
     ON DUPLICATE KEY UPDATE cancellation_policy = ?`,
    [salon_id, policyValue, policyValue]
  );
};

