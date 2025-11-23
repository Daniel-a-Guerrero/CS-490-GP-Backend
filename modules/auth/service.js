const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../../config/database");
const admin = require("../../config/firebaseAdmin");
const { sendEmail } = require("../../services/email");
const clickSendService = require("../../services/clicksendService");
const smsService = require("../../services/smsService");

// =====================
// MANUAL AUTH HELPERS
// =====================

async function findUserByEmail(email) {
  const [rows] = await db.query(
    "SELECT u.*, a.password_hash FROM users u LEFT JOIN auth a ON u.user_id = a.user_id WHERE u.email = ?",
    [email]
  );
  return rows[0];
}

async function createUser(full_name, phone, email, role = "customer") {
  // Generate a unique user_id using UUID or timestamp
  const userId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  const [userResult] = await db.query(
    "INSERT INTO users (user_id, full_name, phone, email, user_role) VALUES (?, ?, ?, ?, ?)",
    [userId, full_name, phone, email, role]
  );
  return userId;
}

async function createAuthRecord(userId, email, password) {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    "INSERT INTO auth (user_id, email, password_hash) VALUES (?, ?, ?)",
    [userId, email, hash]
  );
}

async function upsertPassword(userId, email, password) {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `
    INSERT INTO auth (user_id, email, password_hash)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      password_hash = VALUES(password_hash),
      email = VALUES(email)
    `,
    [userId, email, hash]
  );
}

async function verifyPassword(password, hash) {
  console.log("Incoming password:", password);
  console.log("Stored hash:", hash);

  if (!hash) {
    return false;
  }

  return await bcrypt.compare(password, hash);
}

async function updateLoginStats(userId) {
  await db.query(
    "UPDATE auth SET last_login = NOW(), login_count = login_count + 1 WHERE user_id = ?",
    [userId]
  );
}

function generateJwtToken(payload, expiresIn = "2h") {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

// =====================
// FIREBASE HELPERS (EXTENDED FOR ROLE FLOW)
// =====================

async function verifyFirebaseToken(idToken) {
  return await admin.auth().verifyIdToken(idToken);
}

async function findFirebaseUser(firebaseUid, email) {
  const [rows] = await db.query(
    `SELECT u.user_id, u.user_role, s.salon_id
     FROM users u
     LEFT JOIN salons s ON s.owner_id = u.user_id
     WHERE u.firebase_uid = ? OR u.email = ?
     LIMIT 1`,
    [firebaseUid, email]
  );
  return rows[0];
}

async function createFirebaseUser(firebaseUid, email, role) {
  // Use firebase_uid as user_id, or generate one
  const userId =
    firebaseUid ||
    Date.now().toString(36) + Math.random().toString(36).substr(2);

  const [result] = await db.query(
    "INSERT INTO users (user_id, firebase_uid, email, user_role) VALUES (?, ?, ?, ?)",
    [userId, firebaseUid, email, role]
  );
  return userId;
}

function generateAppJwt(payload, expiresIn = "2h") {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

function generateFirebaseJwt(decoded) {
  return jwt.sign(
    {
      uid: decoded.uid,
      email: decoded.email,
      provider: decoded.firebase.sign_in_provider,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// =====================
// 2FA HELPERS
// =====================

async function get2FAStatus(userId) {
  try {
    const [rows] = await db.query(
      "SELECT * FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true",
      [userId]
    );
    return rows || [];
  } catch (error) {
    console.error(
      "2FA settings table not found, skipping 2FA check:",
      error.message
    );
    return [];
  }
}

async function verify2FACode(userId, code) {
  try {
    const [settings] = await db.query(
      "SELECT method FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true",
      [userId]
    );
    if (!settings || settings.length === 0) return false;

    const [codes] = await db.query(
      "SELECT code_id FROM two_factor_codes WHERE user_id = ? AND code = ? AND expires_at > NOW() AND is_used = false",
      [userId, code]
    );
    if (codes && codes.length > 0) {
      await db.query(
        "UPDATE two_factor_codes SET is_used = true WHERE code_id = ?",
        [codes[0].code_id]
      );
      return true;
    }

    return false;
  } catch (error) {
    console.log("2FA verification error:", error.message);
    return false;
  }
}

async function sendSMSCode(userId, phoneNumber, userName) {
  try {
    if (!phoneNumber) {
      throw new Error("Missing phone number for SMS 2FA");
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      "INSERT INTO two_factor_codes (user_id, code, method, expires_at) VALUES (?, ?, ?, ?)",
      [userId, code, "sms", expiresAt]
    );

    // Try Twilio first, then fall back to ClickSend
    let smsResult = await smsService.send2FACode(phoneNumber, code, userName);
    if (!smsResult?.success) {
      smsResult = await clickSendService.send2FACode(phoneNumber, code);
    }
    if (!smsResult?.success) {
      throw new Error(smsResult?.error || "SMS service unavailable");
    }

    return { success: true };
  } catch (error) {
    console.error("Send SMS code error:", error);
    return { success: false, error: error.message };
  }
}

async function sendEmailCode(userId, email, userName) {
  try {
    if (!email) {
      throw new Error("Missing email for email-based 2FA");
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      "INSERT INTO two_factor_codes (user_id, code, method, expires_at) VALUES (?, ?, ?, ?)",
      [userId, code, "email", expiresAt]
    );

    const firstName = userName ? userName.split(" ")[0] : "there";
    const html = `
      <p>Hi ${firstName},</p>
      <p>Your StyGo verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
      <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    `;

    await sendEmail(email, "Your StyGo verification code", html);

    return { success: true };
  } catch (error) {
    console.error("Send email code error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  // Manual
  findUserByEmail,
  createUser,
  createAuthRecord,
  verifyPassword,
  updateLoginStats,
  upsertPassword,
  generateJwtToken,

  // Firebase
  verifyFirebaseToken,
  findFirebaseUser,
  createFirebaseUser,
  generateAppJwt,
  generateFirebaseJwt,

  // 2FA
  get2FAStatus,
  verify2FACode,
  sendSMSCode,
  sendEmailCode,
};
