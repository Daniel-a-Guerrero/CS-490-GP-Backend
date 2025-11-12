const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const salonController = require("./controller");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "salon-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Always define specific routes BEFORE dynamic ones
router.get(
  "/:salon_id/services",
  verifyAnyToken,
  salonController.getSalonServices
);

router.get("/", verifyAnyToken, salonController.getAllSalons);
router.get("/check-owner", verifyAnyToken, salonController.checkOwnerSalon);
router.get(
  "/:salonId/staff",
  verifyAnyToken,
  salonController.getStaffBySalonId
);
router.get("/staff/schedule", verifyAnyToken, salonController.getDailySchedule);
router.get(
  "/user/visit-history",
  verifyAnyToken,
  salonController.getUserVisitHistory
);

// POST route for creating a salon - use upload.any() to handle all form fields including files
router.post("/", verifyAnyToken, upload.any(), salonController.createSalon);

// Salon settings endpoints
router.get("/:salon_id", verifyAnyToken, salonController.getSalonById);
router.put("/:salon_id", verifyAnyToken, upload.any(), salonController.updateSalon);

module.exports = router;
