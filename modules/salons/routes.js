const express = require('express');
const { verifyFirebaseToken } = require("../../middleware/firebaseAuth");
const router = express.Router();
const salonController = require('./controller');

router.get('/', verifyFirebaseToken, salonController.getAllSalons);
router.get('/:salonId/staff', verifyFirebaseToken, salonController.getStaffBySalonId);
router.get('/staff/schedule', verifyFirebaseToken, salonController.getDailySchedule);
router.get('/user/visit-history', verifyFirebaseToken, salonController.getUserVisitHistory);
module.exports = router;