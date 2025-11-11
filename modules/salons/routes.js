const express = require("express");
const router = express.Router();
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const checkRoles = require("../../middleware/checkRoles");
const salonController = require("./controller");
const upload = require("../../middleware/upload");

// Specific named routes FIRST (before any dynamic routes)
router.get(
  "/check-owner",
  verifyAnyToken,
  checkRoles("owner"),
  salonController.checkOwnerSalon
);

router.get("/staff/schedule", verifyAnyToken, salonController.getDailySchedule);

router.get(
  "/user/visit-history",
  verifyAnyToken,
  salonController.getUserVisitHistory
);

// Get all salons - no auth required for browsing
router.get("/", salonController.getAllSalons);

// POST routes
router.post(
  "/",
  verifyAnyToken,
  checkRoles("owner"),
  upload.single('profile_picture'),
  salonController.createSalon
);

router.post(
  "/profile-picture",
  verifyAnyToken,
  checkRoles("owner"),
  upload.single('profile_picture'),
  salonController.uploadProfilePicture
);

// Dynamic routes with specific paths (e.g. /:id/something)
router.get(
  "/:salon_id/services",
  verifyAnyToken,
  salonController.getSalonServices
);

router.get(
  "/:salonId/staff",
  verifyAnyToken,
  salonController.getStaffBySalonId
);

// Most general dynamic route LAST (/:id matches everything)
router.get("/:id", salonController.getSalonById);

module.exports = router;
