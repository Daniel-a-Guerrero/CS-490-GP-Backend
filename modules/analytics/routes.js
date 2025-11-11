// modules/analytics/routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("./controller");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens"); // adjust path/name to your file
const checkRoles = require("../../middleware/checkRoles");

// GET /api/analytics/overview?salonId=1&start=YYYY-MM-DD&end=YYYY-MM-DD
router.get(
  "/overview",
  verifyAnyToken,
  checkRoles("owner", "admin", "staff"),
  ctrl.getOverview
);

// same protection as overview
router.get(
  "/revenue-series",
  verifyAnyToken,
  checkRoles("owner", "admin", "staff"),
  ctrl.getRevenueSeries
);
router.get(
  "/service-distribution",
  verifyAnyToken,
  checkRoles("owner", "admin", "staff"),
  ctrl.getServiceDistribution
);
router.get(
  "/dashboard",
  verifyAnyToken,
  checkRoles("owner", "admin", "staff"),
  ctrl.getDashboard
);
module.exports = router;
