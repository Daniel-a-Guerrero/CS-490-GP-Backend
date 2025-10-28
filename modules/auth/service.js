<<<<<<< HEAD
const axios = require("axios"); // Promise-based HTTP client, Make http requests from node.js
const db = require('../../config/database');

const firebaseSignIn = async (email, password) => {
    try {
        //const req.param
        const fbResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
            { email: email, password: password, returnSecureToken: true }
        );

        const { idToken, refreshToken, localId } = fbResponse.data;

        try {
            const rows = await db.query(`SELECT * FROM salon_platform_fbase.users WHERE user_id=?`, [localId]);
            console.log(rows)
            const user = rows && rows.length ? rows[0] : null;
            return { idToken, refreshToken, user };
        }
        catch (error) {
            console.error('Failed to fetch staff for the salon', error);
            throw error;
        }
    }
    catch (err) {
        // Pass through Firebase-specific error message when available
        const fbErrMsg = err && err.response && err.response.data && err.response.data.error && err.response.data.error.message;
        console.error('Failed to reach Firebase signInWithPassword:', fbErrMsg || err.message || err);
        if (fbErrMsg) throw new Error(fbErrMsg);
        throw err;
    }
}

const firebaseSignUp = async (full_name, phone, userEmail, passWord, role) => {
    try {
        //const req.param
        const fbResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.FIREBASE_API_KEY}`,
            { email: userEmail, password: passWord, returnSecureToken: true }
        );
        console.log(fbResponse.data)

        const { idToken, email, refreshToken, expiresIn, localId } = fbResponse.data;

        try {
            const rows = await db.query(`INSERT INTO salon_platform_fbase.users 
                                        (user_id, full_name, phone, email, user_role)
                                        VALUES (?,?,?,?,?)`, [localId, full_name, phone,email,role]);
            const users = await db.query('SELECT * FROM salon_platform_fbase.users WHERE user_id = ?', [localId])
            const user = users && users.length ? users[0] : null;
            return { message: "Success",user:{ uid:localId, refreshToken, expiresIn, user }};
        }
        catch (error) {
            console.error('Failed to fetch staff for the salon', error);
            throw error;
        }
    }
    catch (err) {
        // Pass through Firebase-specific error message when available
        const fbErrMsg = err && err.response && err.response.data && err.response.data.error && err.response.data.error.message;
        console.error('Failed to reach Firebase signInWithPassword:', fbErrMsg || err.message || err);
        if (fbErrMsg) throw new Error(fbErrMsg);
        throw err;
    }
}

module.exports = { firebaseSignIn, firebaseSignUp }
=======
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { db } = require("../../config/database");
const admin = require("../../config/firebaseAdmin");

// =====================
// MANUAL AUTH HELPERS
// =====================

async function findUserByEmail(email) {
  const [rows] = await db.query(
    "SELECT u.*, a.password_hash FROM users u JOIN auth a ON u.user_id = a.user_id WHERE u.email = ?",
    [email]
  );
  return rows[0];
}

async function createUser(full_name, phone, email, role = "customer") {
  const [userResult] = await db.query(
    "INSERT INTO users (full_name, phone, email, user_role) VALUES (?, ?, ?, ?)",
    [full_name, phone, email, role]
  );
  return userResult.insertId;
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
  const [result] = await db.query(
    "INSERT INTO users (firebase_uid, email, user_role) VALUES (?, ?, ?)",
    [firebaseUid, email, role]
  );
  return result.insertId;
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
};
>>>>>>> be-daniel
