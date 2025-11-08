const userService = require("./service");

const createUser = async (req, res) => {
  try {
    const { full_name, phone, email, user_role, salon_id } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const role = user_role === "staff" ? "staff" : "customer";

    const newUserId = await userService.createUser(
      full_name,
      phone,
      email,
      role,
      salon_id
    );

    res.status(201).json({
      message: `${
        role.charAt(0).toUpperCase() + role.slice(1)
      } added successfully`,
      user_id: newUserId,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to add user" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

const getCustomers = async (req, res) => {
  try {
    const customers = await userService.getCustomers();
    res.json(customers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

const { db } = require("../../config/database");

/**
 * Get customers for a specific salon
 */
const getSalonCustomers = async (req, res) => {
  try {
    const salonId = req.params.salon_id || req.query.salon_id;

    if (!salonId) {
      return res.status(400).json({ error: "Salon ID is required" });
    }

    const [rows] = await db.query(
      `SELECT DISTINCT u.user_id, u.full_name, u.email, u.phone, sc.joined_at
         FROM salon_customers sc
         JOIN users u ON sc.user_id = u.user_id
        WHERE sc.salon_id = ?
        ORDER BY sc.joined_at DESC`,
      [salonId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching salon customers:", error);
    res.status(500).json({ error: "Failed to fetch salon customers" });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const affected = await userService.updateUser(id, updates);
    if (affected === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const affected = await userService.deleteUser(id);
    if (affected === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getCustomers,
  getSalonCustomers,
};
