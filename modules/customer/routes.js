const express = require("express");
const router = express.Router();
const userController = require("./controller");
const verifyAnyTokens = require("../../middleware/verifyAnyTokens");

router.post("/", verifyAnyTokens, userController.createUser);
router.get("/", verifyAnyTokens, userController.getAllUsers);
router.get("/:id", verifyAnyTokens, userController.getUserById);
router.put("/:id", verifyAnyTokens, userController.updateUser);
router.delete("/:id", verifyAnyTokens, userController.deleteUser);

module.exports = router;
