//staff/routes.js
const express = require("express");
const { verifyFirebaseToken } = require("../../middleware/firebaseAuth");
const router = express.Router();
const staffController = require("./controller");

router.get("/count",verifyFirebaseToken,staffController.getStaffCount)
router.get("/avg",verifyFirebaseToken,staffController.getStaffAvgRev)
router.get("/staff/:sid",verifyFirebaseToken,staffController.getStaff)
router.get("/efficiency/:id",verifyFirebaseToken,staffController.getStaffEfficiency)
router.get("/efficiency",verifyFirebaseToken,staffController.getAvgEfficiency)
router.get("/revenue/:id",verifyFirebaseToken,staffController.getStaffRevenue)

router.post("/staff",verifyFirebaseToken,staffController.addStaff)
router.put("/staff/:id",verifyFirebaseToken,staffController.editStaff)
module.exports=router