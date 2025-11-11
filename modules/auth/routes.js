const express = require("express");
const router = express.Router();
const authController = require("./controller");
const { authenticateUser } = require("../../middleware/firebaseAuth");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const jwt = require("jsonwebtoken");
const admin = require("../../config/firebaseAdmin");
const { db } = require("../../config/database");

// =============================
// MANUAL EMAIL + PASSWORD AUTH
// =============================

router.post("/signup", authController.signupManual);
router.post("/login", authController.loginManual);

router.get("/profile", verifyCustomJwt, (req, res) => {
  res.json({
    message: "Manual JWT verified successfully",
    user: req.user,
  });
});

// =============================
// FIREBASE OAUTH AUTHENTICATION
// =============================

router.post("/verify-firebase", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!idToken) {
      return res.status(401).json({ error: "Missing Firebase token" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decoded;

    const [rows] = await db.query(
      "SELECT user_id, user_role FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1",
      [uid, email]
    );

    if (rows.length > 0) {
      const user = rows[0];
      const jwtToken = jwt.sign(
        { user_id: user.user_id, email, role: user.user_role },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      return res.json({
        existingUser: true,
        token: jwtToken,
        role: user.user_role,
      });
    }
    return res.json({
      newUser: true,
      firebaseUid: uid,
      email,
    });
  } catch (err) {
    console.error("Firebase verification failed:", err);
    res.status(401).json({ error: "Invalid Firebase token" });
  }
});

// =============================
// SET ROLE FOR NEW FIREBASE USER
// =============================

router.post("/set-role", async (req, res) => {
  try {
    const {
      firebaseUid,
      email,
      fullName,
      profilePic,
      phone,
      role,
      businessName,
    } = req.body;

    if (!firebaseUid || !email || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const nameToSave = fullName || email.split("@")[0];
    const phoneToSave = phone || "0000000000"; // placeholder
    const photoToSave = profilePic || null;

    const [result] = await db.query(
      `INSERT INTO users (firebase_uid, full_name, phone, email, profile_pic, user_role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firebaseUid, nameToSave, phoneToSave, email, photoToSave, role]
    );

    const userId = result.insertId;

    if (role === "owner" && businessName) {
      await db.query(
        `INSERT INTO salons (owner_id, salon_name, approved)
         VALUES (?, ?, 'pending')`,
        [userId, businessName]
      );
    }

    const token = jwt.sign(
      { user_id: userId, email, role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({ token, role });
  } catch (err) {
    console.error("Error setting role:", err);
    res.status(500).json({ error: "Server error setting role" });
  }
});

// Middleware that handles both JWT and Firebase authentication
const flexibleAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Try Firebase authentication first
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    req.customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    return next();
  } catch (firebaseErr) {
    // If Firebase fails, try regular JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (jwtErr) {
      console.error("Authentication failed:", jwtErr);
      return res.status(401).json({
        error: "Invalid or expired token",
        message: "Authentication failed",
      });
    }
  }
};

// Protected routes that work with both authentication methods
router.get("/me", flexibleAuth, authController.getCurrentUser);
router.post("/logout", flexibleAuth, (req, res) => {
  res.json({ message: "Logged out successfully" });
});

// 2FA routes - require authentication (use flexibleAuth to support both JWT and Firebase)
router.get("/2fa/status", flexibleAuth, authController.get2FAStatusController);
router.post("/2fa/enable", flexibleAuth, authController.enable2FA);
router.post("/2fa/disable", flexibleAuth, authController.disable2FA);
router.post("/verify-2fa", authController.verify2FA);
router.post("/refresh", authController.refreshToken);
router.delete("/delete-account", flexibleAuth, authController.deleteAccount);

// Temporary debug route to verify token decoding and salon binding
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");

router.get("/me-test", verifyAnyToken, (req, res) => {
  console.log("req.user =", req.user);
  res.json({
    message: "verifyAnyToken middleware is working!",
    user: req.user,
  });
});

module.exports = router;
