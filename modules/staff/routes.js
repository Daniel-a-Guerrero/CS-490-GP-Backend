const express = require("express");
const router = express.Router();
const staffController = require("./controller");

router.get("/count",staffController.getStaffCount)
router.get("/avg",staffController.getStaffAvgRev)
router.get("/staff",staffController.getStaff)
router.get("/efficiency/:id",staffController.getStaffEfficiency)
router.get("/revenue/:id",staffController.getStaffRevenue)

router.post("/staff",staffController.addStaff)