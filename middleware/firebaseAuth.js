const admin = require("../config/firebaseAdmin");
const jwt = require("jsonwebtoken");
const { db } = require("../config/database");
require("dotenv").config();

/**
 * =============================
 * MANUAL JWT AUTHENTICATION
 * =============================
 */
exports.verifyCustomJwt = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach consistent user object
    req.user = {
      id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("Manual JWT verification failed:", err);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

/**
 * =============================
 * FIREBASE AUTH (NO DB LOOKUP)
 * =============================
 * For cases where you just need Firebase identity verified.
 */
exports.authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!idToken) {
      return res.status(401).json({ error: "Missing Firebase token" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decoded;

    // Optionally, create internal custom JWT
    req.customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    next();
  } catch (err) {
    console.error("Firebase authentication failed:", err);

    if (err.code === "auth/id-token-expired") {
      return res.status(401).json({
        error: "Token expired",
        message: "Please log in again",
      });
    }

    res.status(401).json({
      error: "Invalid or expired Firebase token",
      message: "Authentication failed",
    });
  }
};

/**
 * =============================
 * FIREBASE AUTH (WITH DB LOOKUP)
 * =============================
 * Looks up the user in `users` table and attaches consistent req.user
 */
exports.verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    const [users] = await db.query(
      "SELECT user_id, email, user_role, phone FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1",
      [decodedToken.uid, decodedToken.email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Attach consistent structure for role-based access
    req.user = {
      id: user.user_id,
      email: user.email,
      phone: user.phone,
      role: user.user_role,
    };

    next();
  } catch (error) {
    console.error("Firebase token verification failed:", error);

    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        error: "Token expired",
        message: "Please log in again",
      });
    }

    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid token",
    });
  }
};
