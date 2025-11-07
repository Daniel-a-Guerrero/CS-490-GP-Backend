const express=require('express');
import { verifyFirebaseToken } from "../middleware/firebaseAuth.js";
const router=express.Router();
const db=require('../database');
const salonController=require('../controllers/salonControllers');

router.get('/', verifyFirebaseToken, salonController.getAllSalons);
router.get('/free',verifyFirebaseToken, salonController.getFreeDays);   //Send req.body.days with free days
// already exists in staff directory       router.get('/:salonId/staff', verifyFirebaseToken, salonController.getStaffBySalonId);
router.get('/staff/schedule', verifyFirebaseToken, salonController.getDailySchedule);
router.get('/user/visit-history', verifyFirebaseToken, salonController.getUserVisitHistory);

router.post('/newSalon',(req, res)=>{console.log(`In progress`)})

//Maybe move elsewhere, only for admin
router.put('/salon/:sID', verifyFirebaseToken, salonController.verifySalon)
module.exports=router;