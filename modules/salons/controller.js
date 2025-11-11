const { query } = require("../../config/database");
const salonService = require("./service");

// Check if owner has a salon
exports.checkOwnerSalon = async (req, res) => {
  try {
    const ownerId = req.user.user_id;
    
    const rows = await query(
      "SELECT * FROM salons WHERE owner_id = ?",
      [ownerId]
    );

    if (rows.length > 0) {
      res.json({ hasSalon: true, salon: rows[0] });
    } else {
      res.json({ hasSalon: false });
    }
  } catch (err) {
    console.error("Check salon error:", err);
    res.status(500).json({ error: "Failed to check salon" });
  }
};

// Create/Register a new salon (owner only)
exports.createSalon = async (req, res) => {
  try {
    const ownerId = req.user.user_id;
    const { name, address, phone, city, description, email, website } = req.body;

    if (!name || !address || !phone) {
      return res.status(400).json({ error: "Name, address, and phone are required" });
    }

    const existingSalon = await query(
      "SELECT salon_id FROM salons WHERE owner_id = ?",
      [ownerId]
    );

    if (existingSalon.length > 0) {
      return res.status(409).json({ error: "You already have a salon registered" });
    }

    const profile_picture = req.file ? `/uploads/${req.file.filename}` : null;

    const salon = await salonService.createSalon({
      ownerId,
      name,
      address,
      phone,
      city,
      description,
      email,
      website,
      profile_picture,
    });

    res.status(201).json({ message: "Salon registered successfully", salon });
  } catch (err) {
    console.error("Create salon error:", err);
    console.error("Error details:", err.message);
    console.error("Error stack:", err.stack);
    res.status(500).json({ error: err.message || "Failed to create salon" });
  }
};

// Get all active salons for browsing
exports.getAllSalons = async (req, res) => {
  try {
    const { q, page, limit } = req.query;
    const salons = await salonService.getSalons({ 
      q, 
      page: page ? parseInt(page) : 1, 
      limit: limit ? parseInt(limit) : 100 
    });
    res.json(salons);
  } catch (error) {
    console.error("Get salons error:", error);
    res.status(500).json({ error: "Failed to fetch salons" });
  }
};

// Get single salon by ID
exports.getSalonById = async (req, res) => {
  try {
    const salonId = req.params.id;
    const rows = await query(
      "SELECT * FROM salons WHERE salon_id = ? AND status = 'active'",
      [salonId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Salon not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get salon by ID error:", error);
    res.status(500).json({ error: "Failed to fetch salon" });
  }
};

// Upload salon profile picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    const salonId = req.body.salon_id || req.params.salon_id;
    
    if (!salonId) {
      return res.status(400).json({ error: "Salon ID required" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "Profile picture file required" });
    }

    const profile_picture = `/uploads/${req.file.filename}`;
    
    await query(
      "UPDATE salons SET profile_picture = ? WHERE salon_id = ?",
      [profile_picture, salonId]
    );

    res.json({ message: "Profile picture updated", profile_picture });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
};

exports.getStaffBySalonId = async (req, res) => {
  const salonId = req.params.salonId;
  try {
    const staff = await query(
      "SELECT * FROM salon_platform.staff WHERE salon_id=?",
      [salonId]
    );
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch staff for the salon" });
  }
};

// Get services for a salon
exports.getSalonServices = async (req, res) => {
  try {
    const { salon_id } = req.params;
    if (!salon_id) {
      return res.status(400).json({ error: "Salon ID required" });
    }

    const services = await query(
      `
      SELECT 
        s.service_id,
        s.custom_name,
        s.price,
        s.duration,
        s.description,
        c.name AS category_name,
        m.name AS main_category
      FROM services s
      JOIN service_categories c ON s.category_id = c.category_id
      JOIN main_categories m ON c.main_category_id = m.main_category_id
      WHERE s.salon_id = ? AND s.is_active = 1
      ORDER BY m.name, c.name, s.custom_name;
      `,
      [salon_id]
    );

    if (!services || services.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(services);
  } catch (error) {
    console.error(" getSalonServices error:", error);
    return res.status(500).json({ error: "Failed to fetch salon services" });
  }
};

// Get staff daily schedule
exports.getDailySchedule = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const staffId = req.user.uid;
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "Date is required" });
  }
  try {
    const schedule = await query(
      `SELECT a.appointment_id, a.start_time, a.end_time, c.name AS customer_name, s.service_name
                FROM appointments a
                JOIN customers c ON a.customer_id = c.customer_id
                JOIN services s ON a.service_id = s.service_id
                WHERE a.staff_id = ? AND DATE(a.start_time) = ?`,
      [staffId, date]
    );
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily schedule" });
  }
};

// Get user visit history
exports.getUserVisitHistory = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.user.uid;
  try {
    const history = await query(
      `select h.*
            from salon_platform.history h
            where h.user_id=?`,
      [userId]
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch visit history" });
  }
};

// Get customer visit history (for salon owner)
exports.getCustomerVisitHistory = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { customerId } = req.params;
  try {
    const history = await query(
      `select h.*
        from salon_platform.history h
        where h.user_id=?`,
      [customerId]
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customer visit history" });
  }
};
