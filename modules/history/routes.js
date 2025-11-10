//history/routes.js
const express = require("express");
const router = express.Router();
const historyController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.get("/user", verifyCustomJwt, historyController.getUserHistory);
router.get("/salon/:salon_id", verifyCustomJwt, historyController.getSalonVisitHistory);

module.exports = router;

