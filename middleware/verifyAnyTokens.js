const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const { db } = require("../config/database");
require("dotenv").config();

exports.verifyAnyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];

    // Try manual JWT first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        id: decoded.user_id,
        email: decoded.email,
        role: decoded.role,
      };
      return next();
    } catch {
      // Try Firebase next
    }

    try {
      const decodedFirebase = await admin.auth().verifyIdToken(token);
      const [users] = await db.query(
        "SELECT user_id, email, user_role FROM users WHERE firebase_uid = ? OR email = ? LIMIT 1",
        [decodedFirebase.uid, decodedFirebase.email]
      );

      if (!users.length)
        return res
          .status(404)
          .json({ error: "User not found for Firebase ID" });

      const user = users[0];
      req.user = {
        id: user.user_id,
        email: user.email,
        role: user.user_role,
      };
      next();
    } catch (firebaseError) {
      console.error("Token verification failed:", firebaseError);
      res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
    }
  } catch (error) {
    console.error("verifyAnyToken error:", error);
    res.status(500).json({ error: "Token verification error" });
  }
};
