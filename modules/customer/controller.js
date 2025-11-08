const userService = require("./service");

const createUser = async (req, res) => {
  try {
    const {
      firebase_uid,
      full_name,
      phone,
      email,
      profile_pic,
      user_role,
    } = req.body;

    if (!full_name || !email || !user_role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await userService.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "User already exists" });
    }

    const userId = await userService.createUser({
      firebase_uid,
      full_name,
      phone,
      email,
      profile_pic,
      user_role,
    });

    res.status(201).json({ user_id: userId, message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
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
    if (affected === 0) return res.status(404).json({ error: "User not found" });
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
    if (affected === 0) return res.status(404).json({ error: "User not found" });
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
};
