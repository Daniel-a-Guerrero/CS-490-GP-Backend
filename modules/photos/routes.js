//photos/routes.js
const express = require("express");
const router = express.Router();
const photoController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const upload = require("../../middleware/upload");

// Service photos
router.post("/add", verifyCustomJwt, photoController.addServicePhoto);
router.get("/:appointment_id", verifyCustomJwt, photoController.getServicePhotos);

// Salon gallery photos
router.get("/salon/:salon_id", photoController.getSalonGallery);
router.post("/salon", verifyCustomJwt, upload.single('photo'), photoController.addSalonPhoto);
router.delete("/salon/:photo_id", verifyCustomJwt, photoController.deleteSalonPhoto);

module.exports = router;

