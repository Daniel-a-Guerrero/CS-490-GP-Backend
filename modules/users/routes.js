const express = require("express");
const router = express.Router();
const userController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const checkRole = require("../../middleware/checkRoles");
const authorizeUserOrAdmin = require("../../middleware/authorizeUserOrAdmin");

// Admin: view all users
router.get(
  "/",
  verifyCustomJwt,
  checkRole("admin"),
  userController.getAllUsers
);

// Admin or Owner: get all customers
router.get(
  "/customers",
  verifyCustomJwt,
  checkRole("admin", "owner"),
  userController.getCustomers
);

// Admin or self: view single user
router.get(
  "/:id",
  verifyCustomJwt,
  authorizeUserOrAdmin(),
  userController.getUserById
);

// Admin or self: update user
router.put(
  "/:id",
  verifyCustomJwt,
  authorizeUserOrAdmin(),
  userController.updateUser
);

// Admin only: delete user
router.delete(
  "/:id",
  verifyCustomJwt,
  checkRole("admin"),
  userController.deleteUser
);

module.exports = router;
