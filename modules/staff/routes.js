// modules/staff/routes.js
const express = require("express");
const router = express.Router();
const staffController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const checkRole = require("../../middleware/checkRoles");

/* -------------------------------------------------------------------------- */
/*  🔓 PUBLIC ROUTES (no JWT required)  */
/* -------------------------------------------------------------------------- */

// Step 1: Staff sets up PIN from email
router.post("/set-pin", staffController.setStaffPin);

// Step 2: Staff logs in via staff_id + PIN
router.post("/login", staffController.staffLogin);

/* -------------------------------------------------------------------------- */
/*  OWNER / ADMIN ROUTES  */
/* -------------------------------------------------------------------------- */

router.use(verifyCustomJwt);

router.get(
  "/count",
  checkRole(["owner", "admin"]),
  staffController.getStaffCount
);
router.get(
  "/avg",
  checkRole(["owner", "admin"]),
  staffController.getStaffAvgRev
);
router.get(
  "/staff/:sid",
  checkRole(["owner", "admin"]),
  staffController.getStaff
);
router.get(
  "/efficiency/:id",
  checkRole(["owner", "admin"]),
  staffController.getStaffEfficiency
);
router.get(
  "/efficiency",
  checkRole(["owner", "admin"]),
  staffController.getAvgEfficiency
);
router.get(
  "/revenue/:id",
  checkRole(["owner", "admin"]),
  staffController.getStaffRevenue
);
router.post("/staff", checkRole(["owner", "admin"]), staffController.addStaff);
router.put(
  "/staff/:id",
  checkRole(["owner", "admin"]),
  staffController.editStaff
);

module.exports = router;
