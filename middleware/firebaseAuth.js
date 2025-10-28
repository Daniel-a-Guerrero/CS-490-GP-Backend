const admin = require("../config/firebaseAdmin");
const jwt = require("jsonwebtoken");
require("dotenv").config();

/**
 * Middleware: authenticateUser
 * ---------------------------------
 * 1. Reads Firebase token from Authorization header
 * 2. Verifies it via Firebase Admin
 * 3. Generates your custom JWT (optional)
 * 4. Attaches decoded Firebase user + custom token to req
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

    //Verify Firebase ID token
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decoded; // save user info for controller access

    //Optionally, create your own JWT for internal use
    const customJwt = jwt.sign(
      { uid: decoded.uid, email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    req.customJwt = customJwt;

    next(); // move on to next middleware or controller
  } catch (err) {
    console.error("Firebase authentication failed:", err);
    res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
};

module.exports = { authenticateUser };
