const admin = require("../config/firebaseAdmin");
const jwt = require("jsonwebtoken");
const { db } = require("../config/database");
require("dotenv").config();

/**
 * Middleware: authenticateUser
 * ---------------------------------
 * 1. Reads Firebase token from Authorization header
 * 2. Verifies it via Firebase Admin
 * 3. Optionally looks up user in database
 * 4. Generates your custom JWT
 * 5. Attaches decoded Firebase user + custom token to req
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!idToken) {
      return res.status(401).json({ error: "Missing Firebase token" });
    }

    // Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decoded; // save user info for controller access

    // Optionally, create your own JWT for internal use
    const customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    req.customJwt = customJwt;

    next(); // move on to next middleware or controller
  } catch (err) {
    console.error("Firebase authentication failed:", err);
    
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Please log in again' 
      });
    }
    
    res.status(401).json({ 
      error: "Invalid or expired Firebase token",
      message: "Authentication failed"
    });
  }
};

/**
 * Middleware: verifyFirebaseToken
 * ---------------------------------
 * Same as authenticateUser but also looks up user in database
 * and attaches user info to req.user
 */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const token = authHeader.split("Bearer ")[1];
    
    // Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Attach user info from database
    const [users] = await db.query(
      'SELECT user_id, email, user_role, phone FROM users WHERE firebase_uid = ?',
      [decodedToken.uid]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const user = users[0];
    req.user = {
      id: decodedToken.uid,
      email: user.email,
      phone: user.phone,
      role: user.user_role
    };
    
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expired', 
        message: 'Please log in again' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid token' 
    });
  }
};

module.exports = { authenticateUser, verifyFirebaseToken };
