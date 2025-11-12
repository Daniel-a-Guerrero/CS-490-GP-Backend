const authService = require("./service");
const userService = require("../users/service");
const { db } = require("../../config/database");

// ==========================
// MANUAL SIGNUP
// ==========================
exports.signupManual = async (req, res) => {
  const { full_name, phone, email, password, role, businessName, businessAddress, businessWebsite } = req.body;

  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser)
      return res.status(409).json({ error: "Email already registered" });

    const userRole = role || "customer";
    const userId = await userService.createUser(
      full_name,
      phone,
      email,
      userRole
    );

    await authService.createAuthRecord(userId, email, password);

    // If user is owner, create salon record with business info
    if (userRole === "owner" && businessName) {
      // Generate slug from business name
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      await db.query(
        `INSERT INTO salons (owner_id, name, slug, address, email, phone, website, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, businessName, slug, businessAddress || null, email, phone, businessWebsite || null]
      );
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
};

// ==========================
// MANUAL LOGIN
// ==========================
exports.loginManual = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const user = await authService.findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await authService.verifyPassword(
      password,
      user.password_hash
    );
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    // Check if 2FA is enabled
    const twoFactorStatus = await authService.get2FAStatus(user.user_id);
    if (twoFactorStatus && twoFactorStatus.length > 0) {
      const tempToken = authService.generateJwtToken(
        {
          user_id: user.user_id,
          email: user.email,
          role: user.user_role,
          temp2FA: true,
        },
        "15m"
      );

      const method = twoFactorStatus[0].method;
      let sendResult;

      if (method === "sms") {
        sendResult = await authService.sendSMSCode(
          user.user_id,
          twoFactorStatus[0].phone_number || user.phone,
          user.full_name
        );
      } else if (method === "email") {
        sendResult = await authService.sendEmailCode(
          user.user_id,
          user.email,
          user.full_name
        );
      } else {
        return res.status(400).json({
          error: `2FA method '${method}' is not supported yet`,
        });
      }

      if (!sendResult?.success) {
        return res.status(500).json({
          error: "Failed to send verification code",
          details: sendResult?.error,
        });
      }

      return res.status(200).json({
        message: "2FA verification required",
        requires2FA: true,
        tempToken,
        method,
      });
    }

    // Regular login (no 2FA)
    await authService.updateLoginStats(user.user_id);
    const token = authService.generateJwtToken({
      user_id: user.user_id,
      email: user.email,
      role: user.user_role,
    });

    // Set secure HTTP-only cookie for middleware + persistence
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "lax",
      maxAge: 60 * 60 * 1000, // 1 hour
      path: "/", // cookie valid on all routes
    });

    // ✅ Also return JSON body (frontend may still use token locally)
    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.user_role,
        full_name: user.full_name,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
};

// ==========================
// FIREBASE VERIFY
// ==========================
exports.verifyFirebase = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!idToken)
      return res.status(401).json({ error: "Missing Firebase token" });

    const decoded = await authService.verifyFirebaseToken(idToken);
    const { uid, email } = decoded;

    // check if already exists
    const existingUser = await authService.findFirebaseUser(uid, email);
    if (existingUser) {
      const token = authService.generateAppJwt({
        user_id: existingUser.user_id,
        email,
        role: existingUser.user_role,
        salon_id: existingUser.salon_id,
      });
      return res.json({
        existingUser: true,
        token,
        role: existingUser.user_role,
      });
    }

    // new user
    return res.json({ newUser: true, firebaseUid: uid, email });
  } catch (err) {
    console.error("Firebase verification failed:", err);
    res.status(401).json({ error: "Invalid Firebase token" });
  }
};

// ==========================
// SET ROLE
// ==========================
exports.setRole = async (req, res) => {
  try {
    const { firebaseUid, email, role } = req.body;
    if (!firebaseUid || !email || !role)
      return res.status(400).json({ error: "Missing fields" });

    const userId = await authService.createFirebaseUser(
      firebaseUid,
      email,
      role
    );
    const token = authService.generateAppJwt({ user_id: userId, email, role });
    res.status(201).json({ token, role });
  } catch (err) {
    console.error("Error setting role:", err);
    res.status(500).json({ error: "Server error while setting role" });
  }
};

// ==========================
// CURRENT USER + LOGOUT
// ==========================
exports.getCurrentUser = async (req, res) => {
  try {
    if (req.firebaseUser) {
      const email = req.firebaseUser.email;
      const [rows] = await db.query(
        `SELECT 
           u.*, 
           s.salon_id, 
           s.slug AS salon_slug, 
           s.name AS salon_name
         FROM users u
         LEFT JOIN salons s ON s.owner_id = u.user_id
         WHERE u.email = ?`,
        [email]
      );

      if (!rows.length)
        return res.status(404).json({ error: "User not found" });

      return res.json({
        firebaseUser: req.firebaseUser,
        customJWT: req.customJwt,
        user: rows[0],
      });
    } else if (req.user) {
      const [rows] = await db.query(
        `SELECT 
           u.*, 
           s.salon_id, 
           s.slug AS salon_slug, 
           s.name AS salon_name
         FROM users u
         LEFT JOIN salons s ON s.owner_id = u.user_id
         WHERE u.user_id = ? OR u.email = ?`,
        [req.user.user_id, req.user.email]
      );

      if (!rows.length)
        return res.status(404).json({ error: "User not found" });

      return res.json({ user: rows[0] });
    } else {
      return res.status(401).json({ error: "Not authenticated" });
    }
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Database error" });
  }
};

exports.logout = async (req, res) => {
  res.json({ message: "Logged out successfully" });
};

// ==========================
// 2FA CONTROLLERS
// ==========================

exports.enable2FA = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const { method, phoneNumber: providedPhoneNumber } = req.body;

    if (!method || !["sms", "email"].includes(method)) {
      return res.status(400).json({ error: "Invalid 2FA method" });
    }

    const [userRows] = await db.query(
      "SELECT phone, email FROM users WHERE user_id = ?",
      [userId]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userRows[0];
    let phoneNumber = providedPhoneNumber || user.phone;

    if (providedPhoneNumber && providedPhoneNumber !== user.phone) {
      await db.query("UPDATE users SET phone = ? WHERE user_id = ?", [
        providedPhoneNumber,
        userId,
      ]);
      phoneNumber = providedPhoneNumber;
    }

    phoneNumber = method === "sms" ? phoneNumber : null;

    const [existing] = await db.query(
      "SELECT * FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true",
      [userId]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: "2FA is already enabled" });
    }

    await db.query(
      "INSERT INTO user_2fa_settings (user_id, method, is_enabled, phone_number) VALUES (?, ?, ?, ?)",
      [userId, method, true, phoneNumber]
    );

    res.status(200).json({ message: "2FA enabled successfully" });
  } catch (error) {
    console.error("Enable 2FA error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;

    await db.query(
      "UPDATE user_2fa_settings SET is_enabled = false WHERE user_id = ?",
      [userId]
    );

    res.status(200).json({ message: "2FA disabled successfully" });
  } catch (error) {
    console.error("Disable 2FA error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.get2FAStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const status = await authService.get2FAStatus(userId);

    res
      .status(200)
      .json({ twoFactorEnabled: status && status.length > 0, methods: status });
  } catch (error) {
    console.error("Get 2FA status error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.verify2FA = async (req, res) => {
  try {
    const { code, tempToken } = req.body;

    if (!code || !tempToken) {
      return res
        .status(400)
        .json({ error: "Code and temporary token are required" });
    }

    // Verify the temporary token
    const jwt = require("jsonwebtoken");
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ error: "Invalid or expired temporary token" });
    }

    if (!decoded.temp2FA) {
      return res
        .status(400)
        .json({ error: "Invalid token for 2FA verification" });
    }

    const userId = decoded.user_id;

    // Verify the 2FA code
    const isValid = await authService.verify2FACode(userId, code);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid verification code" });
    }

    // Generate final token
    await authService.updateLoginStats(userId);
    const finalToken = authService.generateJwtToken({
      user_id: userId,
      email: decoded.email,
      role: decoded.role,
    });

    // Get user details
    const [rows] = await db.query(
      "SELECT user_id, email, user_role, full_name FROM users WHERE user_id = ?",
      [userId]
    );

    res.cookie("token", finalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      message: "2FA verification successful",
      token: finalToken,
      user: rows[0],
    });
  } catch (error) {
    console.error("Verify 2FA error:", error);
    return res.status(500).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  const oldToken = req.cookies?.token;
  if (!oldToken) return res.status(401).json({ error: "Missing token" });

  try {
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET, {
      ignoreExpiration: true,
    });
    const newToken = jwt.sign(
      {
        user_id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600 * 1000, // 1 hour
    });

    return res.json({ message: "Token refreshed", token: newToken });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Delete Account
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    // Get user's email to verify password
    const [users] = await db.query(
      "SELECT u.email FROM users u WHERE u.user_id = ?",
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userEmail = users[0].email;

    // Verify password
    const [authRecords] = await db.query(
      "SELECT password_hash FROM auth WHERE email = ?",
      [userEmail]
    );

    if (authRecords && authRecords.length > 0) {
      const isValid = await authService.verifyPassword(
        password,
        authRecords[0].password_hash
      );

      if (!isValid) {
        return res.status(401).json({ error: "Invalid password" });
      }
    }

    // Delete user (cascade will handle related records)
    const affected = await userService.deleteUser(userId);

    if (affected === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ error: "Failed to delete account" });
  }
};
