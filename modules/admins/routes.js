//admins/routes.js
const express = require("express");
const router = express.Router();
const adminController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.get("/user-engagement", verifyCustomJwt, adminController.getUserEngagement);
router.get("/appointment-trends", verifyCustomJwt, adminController.getAppointmentTrends);
router.get("/salon-revenues", verifyCustomJwt, adminController.getSalonRevenues);
router.get("/loyalty-usage", verifyCustomJwt, adminController.getLoyaltyUsage);
router.get("/user-demographics", verifyCustomJwt, adminController.getUserDemographics);
router.get("/customer-retention", verifyCustomJwt, adminController.getCustomerRetention);
router.get("/reports", verifyCustomJwt, adminController.getReports);
router.get("/system-logs", verifyCustomJwt, adminController.getSystemLogs);

module.exports = router;

