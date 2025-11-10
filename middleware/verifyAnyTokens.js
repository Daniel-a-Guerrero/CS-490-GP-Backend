const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const { db } = require("../config/database");
require("dotenv").config();

/**
 * Middleware that validates either:
 * - A custom manual JWT (created by backend), OR
 * - A Firebase ID token.
 *
 * It automatically attaches `req.user` with:
 *   { user_id, email, role, salon_id }
 */
exports.verifyAnyToken = async (req, res, next) => {
  try {
    // Try to get token from cookie OR Authorization header
    const cookieToken = req.cookies?.token;
    const authHeader = req.headers.authorization || "";
    const headerToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return res.status(401).json({ error: "Missing or invalid token format" });
    }

    // ======================================================
    // 1️⃣ TRY MANUAL JWT FIRST
    // ======================================================
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const [rows] = await db.query(
        `
        SELECT u.user_id, u.email, u.user_role, s.salon_id
        FROM users u
        LEFT JOIN salons s ON s.owner_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
        `,
        [decoded.user_id]
      );

      const userRecord = rows[0] || {};
      req.user = {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
        salon_id: userRecord.salon_id || null,
      };

      return next();
    } catch (jwtErr) {
      // continue to Firebase if JWT fails
    }

    // ======================================================
    // 2️⃣ TRY FIREBASE TOKEN NEXT
    // ======================================================
    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);

      const [rows] = await db.query(
        `
        SELECT u.user_id, u.email, u.user_role, s.salon_id
        FROM users u
        LEFT JOIN salons s ON s.owner_id = u.user_id
        WHERE u.firebase_uid = ? OR LOWER(u.email) = LOWER(?)
        LIMIT 1
        `,
        [decodedFirebase.uid, decodedFirebase.email]
      );

      if (!rows.length) {
        return res
          .status(404)
          .json({ error: "User not found for Firebase ID" });
      }

      const user = rows[0];
      req.user = {
        user_id: user.user_id,
        email: user.email,
        role: user.user_role,
        salon_id: user.salon_id || null,
      };

      return next();
    } catch (firebaseError) {
      console.error(
        "Firebase token verification failed:",
        firebaseError.message
      );
      return res.status(401).json({
        error: "Invalid or expired token",
      });
    }
  } catch (error) {
    console.error("verifyAnyToken error:", error);
    res.status(500).json({ error: "Token verification error" });
  }
};
