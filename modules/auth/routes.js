const express = require("express");
const router = express.Router();
const authController = require('./controller');
const authenticateUser = require('../../middleware/firebaseAuth');

router.get('/test',authController.miscel);

// =============================
// MANUAL EMAIL + PASSWORD AUTH
// =============================

//router.get('/me', authenticateUser, authController.getCurrentUser);
router.post('/logout', authController.logout);

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

// Firebase-protected routes
router.get("/me", authenticateUser, authController.getCurrentUser);
router.post("/logout", authenticateUser, authController.logout);

module.exports = router;
