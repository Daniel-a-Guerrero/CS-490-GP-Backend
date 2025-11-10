//photos/routes.js
const express = require("express");
const router = express.Router();
const photoController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/add", verifyCustomJwt, photoController.addServicePhoto);
router.get("/:appointment_id", verifyCustomJwt, photoController.getServicePhotos);

module.exports = router;

