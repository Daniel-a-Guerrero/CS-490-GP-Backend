const express = require("express");
const router = express.Router();
const userController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");
const { verifyAnyToken } = require("../../middleware/verifyAnyTokens");
const checkRole = require("../../middleware/checkRoles");
const authorizeUserOrAdmin = require("../../middleware/authorizeUserOrAdmin");

// Admin: view all users
router.get(
  "/",
  verifyCustomJwt,
  checkRole("admin"),
  userController.getAllUsers
);

router.get("/me", verifyAnyToken, async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (err) {
    console.error("Error fetching current user:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

// Admin or Owner: get all customers
router.get(
  "/customers",
  verifyCustomJwt,
  checkRole("admin", "owner"),
  userController.getCustomers
);

// Owner or Staff: get salon-specific customers (used in NewAppointmentModal)
router.get(
  "/salon-customers",
  verifyAnyToken,
  checkRole("owner", "staff", "admin"),
  userController.getSalonCustomers
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
