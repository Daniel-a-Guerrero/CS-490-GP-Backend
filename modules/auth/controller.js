const authService = require("./service");
const { db } = require("../../config/database");

// ==========================
// MANUAL SIGNUP
// ==========================
exports.signupManual = async (req, res) => {
  const { full_name, phone, email, password, role } = req.body;

  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser)
      return res.status(409).json({ error: "Email already registered" });

    const userRole = role || "customer";
    const userId = await authService.createUser(full_name, phone, email, userRole);
    await authService.createAuthRecord(userId, email, password);

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
      const tempToken = authService.generateJwtToken({
        user_id: user.user_id,
        email: user.email,
        role: user.user_role,
        temp2FA: true,
      }, '15m');
      
      const method = twoFactorStatus[0].method;
      if (method === 'sms') {
        const result = await authService.sendSMSCode(user.user_id, user.phone, user.full_name);
        
        return res.status(200).json({
          message: "2FA verification required",
          requires2FA: true,
          tempToken,
          method: 'sms',
        });
      }
      return res.status(200).json({
        message: "2FA verification required",
        requires2FA: true,
        tempToken,
        method: method,
      });
    }

    await authService.updateLoginStats(user.user_id);
    const token = authService.generateJwtToken({
      user_id: user.user_id,
      email: user.email,
      role: user.user_role,
    });

    res.json({ message: "Login successful", token, user: { id: user.user_id, email: user.email, role: user.user_role, full_name: user.full_name } });
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
    // Handle both Firebase and regular JWT authentication
    if (req.firebaseUser) {
      // Firebase authentication
      const email = req.firebaseUser.email;
      const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
      return res.json({
        firebaseUser: req.firebaseUser,
        customJWT: req.customJwt,
        userProfile: rows[0],
        user: rows[0],
      });
    } else if (req.user) {
      // Regular JWT authentication
      const [rows] = await db.query("SELECT * FROM users WHERE user_id = ? OR email = ?", [
        req.user.user_id,
        req.user.email,
      ]);
      return res.json({
        user: rows[0],
        userProfile: rows[0],
      });
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
    
    if (!method || !['sms', 'email', 'authenticator'].includes(method)) {
      return res.status(400).json({ error: 'Invalid 2FA method' });
    }
    
    const [userRows] = await db.query('SELECT phone, email FROM users WHERE user_id = ?', [userId]);
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRows[0];
    let phoneNumber = providedPhoneNumber || user.phone;
    
    if (providedPhoneNumber && providedPhoneNumber !== user.phone) {
      await db.query('UPDATE users SET phone = ? WHERE user_id = ?', [providedPhoneNumber, userId]);
      phoneNumber = providedPhoneNumber;
    }
    
    phoneNumber = method === 'sms' ? phoneNumber : null;
    const email = method === 'email' ? user.email : null;
    
    const [existing] = await db.query(
      'SELECT * FROM user_2fa_settings WHERE user_id = ? AND is_enabled = true',
      [userId]
    );
    
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }
    
    await db.query(
      'INSERT INTO user_2fa_settings (user_id, method, is_enabled, phone_number, email) VALUES (?, ?, ?, ?, ?)',
      [userId, method, true, phoneNumber, email]
    );
    
    res.status(200).json({ message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.disable2FA = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    
    await db.query(
      'UPDATE user_2fa_settings SET is_enabled = false WHERE user_id = ?',
      [userId]
    );
    
    res.status(200).json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.get2FAStatusController = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const status = await authService.get2FAStatus(userId);
    
    res.status(200).json({ twoFactorEnabled: status && status.length > 0, methods: status });
  } catch (error) {
    console.error('Get 2FA status error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.verify2FA = async (req, res) => {
  try {
    const { code, tempToken } = req.body;
    
    if (!code || !tempToken) {
      return res.status(400).json({ error: 'Code and temporary token are required' });
    }
    
    // Verify the temporary token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired temporary token' });
    }
    
    if (!decoded.temp2FA) {
      return res.status(400).json({ error: 'Invalid token for 2FA verification' });
    }
    
    const userId = decoded.user_id;
    
    // Verify the 2FA code
    const isValid = await authService.verify2FACode(userId, code);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }
    
    // Generate final token
    await authService.updateLoginStats(userId);
    const finalToken = authService.generateJwtToken({
      user_id: userId,
      email: decoded.email,
      role: decoded.role,
    });
    
    // Get user details
    const [rows] = await db.query('SELECT user_id, email, user_role, full_name FROM users WHERE user_id = ?', [userId]);
    
    res.status(200).json({
      message: '2FA verification successful',
      token: finalToken,
      user: rows[0]
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    return res.status(500).json({ error: error.message });
  }
};
