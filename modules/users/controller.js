const userService = require("./service");
const { db } = require("../../config/database");

const createUser = async (req, res) => {
  try {
    const { full_name, phone, email, user_role, salon_id } = req.body;
    if (!full_name || !email)
      return res.status(400).json({ error: "Name and email are required" });
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

const getSalonCustomers = async (req, res) => {
  try {
    const { salon_id, search = "" } = req.query;
    if (!salon_id) return res.status(400).json({ error: "Salon ID required" });
    const keyword = `%${search}%`;
    const [rows] = await db.query(
      `
      SELECT 
        u.user_id, u.full_name, u.email, u.phone,
        sc.address, sc.city, sc.state, sc.zip, sc.notes
      FROM salon_customers sc
      JOIN users u ON sc.user_id = u.user_id
      WHERE sc.salon_id = ?
        AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
      ORDER BY u.full_name ASC
      LIMIT 15
      `,
      [salon_id, keyword, keyword, keyword]
    );
    res.json(rows);
  } catch (error) {
    console.error("getSalonCustomers error:", error);
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
  getCustomers,
  getSalonCustomers,
  getUserById,
  updateUser,
  deleteUser,
};
