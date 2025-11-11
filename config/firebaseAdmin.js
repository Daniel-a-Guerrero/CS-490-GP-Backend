const admin = require("firebase-admin");
require("dotenv").config();

// Only initialize Firebase if credentials are provided
if (!admin.apps.length && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.warn("Firebase Admin initialization skipped:", error.message);
  }
} else if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.log("Firebase credentials not found - running without Firebase");
}

module.exports = admin;
