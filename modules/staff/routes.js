const express = require("express");
const router = express.Router();
const staffController = require("./controller");

router.get("/count",staffController.getStaffCount)
router.get("/avg",staffController.getStaffAvgRev)
router.get("/staff",staffController.getStaff)