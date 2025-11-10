const express = require("express");
const router = express.Router();
const userController = require("./controller");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");

router.post("/", verifyAnyToken, userController.createUser);
router.get("/", verifyAnyToken, userController.getAllUsers);
router.get("/:id", verifyAnyToken, userController.getUserById);
router.put("/:id", verifyAnyToken, userController.updateUser);
router.delete("/:id", verifyAnyToken, userController.deleteUser);

module.exports = router;
