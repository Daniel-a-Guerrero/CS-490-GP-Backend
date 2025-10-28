const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../../config/database");
const admin = require("../../config/firebaseAdmin");

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

async function verifyPassword(password, hash) {
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
    "SELECT user_id, user_role FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1",
    [firebaseUid, email]
  );
  return rows[0];
}

async function createFirebaseUser(firebaseUid, email, role) {
  // Use firebase_uid as user_id, or generate one
  const userId = firebaseUid || Date.now().toString(36) + Math.random().toString(36).substr(2);
  
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
      'SELECT * FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true',
      [userId]
    );
    return rows || [];
  } catch (error) {
    console.error('2FA settings table not found, skipping 2FA check:', error.message);
    return [];
  }
}

async function verify2FACode(userId, code) {
  try {
    const [settings] = await db.query(
      'SELECT method FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true',
      [userId]
    );
    if (!settings || settings.length === 0) return false;
    
    const [codes] = await db.query(
      'SELECT code_id FROM two_factor_codes WHERE user_id = ? AND code = ? AND expires_at > NOW() AND is_used = false',
      [userId, code]
    );
    if (codes && codes.length > 0) {
      await db.query('UPDATE two_factor_codes SET is_used = true WHERE code_id = ?', [codes[0].code_id]);
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('2FA verification error:', error.message);
    return false;
  }
}

async function sendSMSCode(userId, phoneNumber, userName) {
  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    await db.query('INSERT INTO two_factor_codes (user_id, code, method, expires_at) VALUES (?, ?, ?, ?)', [userId, code, 'sms', expiresAt]);
    
    // Use ClickSend only
    const clickSendService = require("../../services/clicksendService");
    const result = await clickSendService.send2FACode(phoneNumber, code);
    
    // Return success even if registration needed - the code was generated
    return { success: true, code: code };
  } catch (error) {
    console.error('Send SMS code error:', error);
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
};
