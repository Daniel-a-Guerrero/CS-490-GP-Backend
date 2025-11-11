const userService = require("./service");
const { db } = require("../../config/database");
const { sendEmail } = require("../../services/email");

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

const getSalonCustomerStats = async (req, res) => {
  try {
    const salonId = Number(req.query.salon_id || req.user?.salon_id);
    if (!salonId) {
      return res.status(400).json({ error: "Salon ID required" });
    }

    const [rows] = await db.query(
      `
      WITH customer_totals AS (
        SELECT
          sc.user_id,
          COUNT(DISTINCT a.appointment_id) AS visit_count,
          COALESCE(
            SUM(
              CASE
                WHEN a.status IN ('confirmed','completed')
                THEN a.price
                ELSE 0
              END
            ),
            0
          ) AS total_spent
        FROM salon_customers sc
        LEFT JOIN appointments a
          ON a.user_id = sc.user_id
         AND a.salon_id = sc.salon_id
        WHERE sc.salon_id = ?
        GROUP BY sc.user_id
      )
      SELECT
        COALESCE(COUNT(*), 0) AS total_customers,
        COALESCE(
          SUM(
            CASE
              WHEN total_spent >= 500 OR visit_count >= 10 THEN 1
              ELSE 0
            END
          ),
          0
        ) AS vip_customers,
        COALESCE(SUM(total_spent), 0) AS total_revenue,
        COALESCE(AVG(total_spent), 0) AS avg_spend
      FROM customer_totals;
      `,
      [salonId]
    );

    const stats =
      rows[0] || {
        total_customers: 0,
        vip_customers: 0,
        total_revenue: 0,
        avg_spend: 0,
      };

    res.json({ stats });
  } catch (error) {
    console.error("getSalonCustomerStats error:", error);
    res.status(500).json({ error: "Failed to compute customer stats" });
  }
};

const getSalonCustomerDirectory = async (req, res) => {
  try {
    const salonId = Number(req.query.salon_id || req.user?.salon_id);
    if (!salonId) {
      return res.status(400).json({ error: "Salon ID required" });
    }

    const [rows] = await db.query(
      `
      WITH appointment_totals AS (
        SELECT
          a.user_id,
          a.salon_id,
          COUNT(*) AS total_visits,
          COALESCE(
            SUM(
              CASE
                WHEN a.status IN ('confirmed','completed')
                THEN a.price
                ELSE 0
              END
            ),
            0
          ) AS total_spent,
          MAX(a.scheduled_time) AS last_visit
        FROM appointments a
        WHERE a.salon_id = ?
        GROUP BY a.user_id, a.salon_id
      ),
      fav_staff AS (
        SELECT
          a.user_id,
          a.salon_id,
          su.full_name AS staff_name,
          ROW_NUMBER() OVER (
            PARTITION BY a.user_id, a.salon_id
            ORDER BY COUNT(*) DESC
          ) AS rn
        FROM appointments a
        JOIN staff st ON st.staff_id = a.staff_id
        JOIN users su ON su.user_id = st.user_id
        WHERE a.salon_id = ? AND a.staff_id IS NOT NULL
        GROUP BY a.user_id, a.salon_id, su.full_name
      )
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        COALESCE(at.total_visits, 0) AS total_visits,
        COALESCE(at.total_spent, 0) AS total_spent,
        at.last_visit,
        CASE
          WHEN COALESCE(at.total_spent, 0) >= 500 OR COALESCE(at.total_visits, 0) >= 10
          THEN 'VIP'
          ELSE ''
        END AS membership_tier,
        fs.staff_name AS favorite_staff
      FROM salon_customers sc
      JOIN users u ON u.user_id = sc.user_id
      LEFT JOIN appointment_totals at
        ON at.user_id = sc.user_id
       AND at.salon_id = sc.salon_id
      LEFT JOIN fav_staff fs
        ON fs.user_id = sc.user_id
       AND fs.salon_id = sc.salon_id
       AND fs.rn = 1
      WHERE sc.salon_id = ?
      ORDER BY u.full_name ASC;
      `,
      [salonId, salonId, salonId]
    );

    res.json({ customers: rows });
  } catch (error) {
    console.error("getSalonCustomerDirectory error:", error);
    res.status(500).json({ error: "Failed to fetch customer directory" });
  }
};

const addSalonCustomer = async (req, res) => {
  try {
    const salonId = Number(req.body.salon_id || req.user?.salon_id);
    const {
      full_name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      notes,
    } = req.body;

    if (!salonId || !full_name || !email) {
      return res
        .status(400)
        .json({ error: "Salon, name, and email are required" });
    }

    let userId;
    const [existing] = await db.query(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length) {
      userId = existing[0].user_id;
      await db.query(
        "UPDATE users SET full_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [full_name, phone || null, userId]
      );
    } else {
      userId = await userService.createUser(full_name, phone, email, "customer");
    }

    await db.query(
      `
      INSERT INTO salon_customers (salon_id, user_id, address, city, state, zip, notes, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(NOW(), CURRENT_TIMESTAMP))
      ON DUPLICATE KEY UPDATE
        address = VALUES(address),
        city = VALUES(city),
        state = VALUES(state),
        zip = VALUES(zip),
        notes = VALUES(notes);
      `,
      [salonId, userId, address || null, city || null, state || null, zip || null, notes || null]
    );

    const frontendBase = process.env.NEXT_PUBLIC_APP_URL || "https://stygo.app";
    const portalLink = `${frontendBase}/sign-in`;
    const emailHtml = `
      <h2>Welcome to StyGo!</h2>
      <p>Hi ${full_name.split(" ")[0]},</p>
      <p>You've been added as a customer at our salon. You can book or review your upcoming appointments any time.</p>
      <p>
        <a href="${portalLink}" style="display:inline-block;padding:10px 20px;background:#10b981;color:white;border-radius:6px;text-decoration:none;">
          Visit StyGo Portal
        </a>
      </p>
      <p>If you already have an appointment scheduled, you will receive separate confirmations with all the details.</p>
      <br/>
      <p>Thanks,<br/>The StyGo Team</p>
    `;
    await sendEmail(email, "You're now connected with StyGo", emailHtml);

    res.status(201).json({
      message: "Customer added successfully",
      customer: {
        user_id: userId,
        full_name,
        email,
        phone,
      },
    });
  } catch (error) {
    console.error("addSalonCustomer error:", error);
    res.status(500).json({ error: "Failed to add customer" });
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
  getSalonCustomerStats,
  getSalonCustomerDirectory,
  addSalonCustomer,
  getUserById,
  updateUser,
  deleteUser,
};
