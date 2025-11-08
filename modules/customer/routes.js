const express = require("express");
const router = express.Router();
const userController = require("./controller");
const { verifyFirebaseToken } = require("../../middleware/firebaseAuth");

router.post("/", verifyFirebaseToken, userController.createUser);
router.get("/", verifyFirebaseToken, userController.getAllUsers);
router.get("/:id", verifyFirebaseToken, userController.getUserById);
router.put("/:id", verifyFirebaseToken, userController.updateUser);
router.delete("/:id", verifyFirebaseToken, userController.deleteUser);

module.exports = router;
