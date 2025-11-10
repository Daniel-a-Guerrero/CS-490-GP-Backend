//notifications/routes.js
const express = require("express");
const router = express.Router();
const notificationController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/reminder", verifyCustomJwt, notificationController.sendAppointmentReminder);
router.post("/promotion", verifyCustomJwt, notificationController.sendPromotionalOffer);
router.post("/delay", verifyCustomJwt, notificationController.notifyClientDelay);
router.post("/discount", verifyCustomJwt, notificationController.notifyUserDiscount);

router.get("/", verifyCustomJwt, notificationController.getUserNotifications);
router.put("/:id/read", verifyCustomJwt, notificationController.markNotificationRead);
router.put("/read-all", verifyCustomJwt, notificationController.markAllNotificationsRead);

module.exports = router;

