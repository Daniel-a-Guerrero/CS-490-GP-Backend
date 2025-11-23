const { query } = require("../../config/database");
const salonService = require("./service");

//As a user, I want to browse available salons so that I can choose where to book
exports.getAllSalons = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const { q, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `
      SELECT 
        s.salon_id,
        COALESCE(s.name, s.salon_name) AS name,
        s.slug,
        s.address,
        s.city,
        s.phone,
        s.email,
        s.website,
        s.description,
        s.profile_picture,
        s.status,
        s.created_at,
        u.full_name as owner_name
      FROM salons s
      LEFT JOIN users u ON u.user_id = s.owner_id
      WHERE s.status = 'active' OR s.status = 'pending'
    `;
    
    const params = [];
    
    if (q) {
      sql +=
        " AND (COALESCE(s.name, s.salon_name) LIKE ? OR s.description LIKE ? OR s.city LIKE ?)";
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    
    sql += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    
    const salons = await query(sql, params);
    res.json(salons);
  } catch (error) {
    console.error("Error fetching salons:", error);
    res.status(500).json({ error: "Failed to fetch salons" });
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

    console.log(
      "DEBUG: Found services:",
      services.length,
      "for salon_id:",
      salon_id
    );

    //  Return empty array instead of 404 to prevent front-end error
    if (!services || services.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(services);
  } catch (error) {
    console.error(" getSalonServices error:", error);
    return res.status(500).json({ error: "Failed to fetch salon services" });
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
  const staffId = req.user.uid; // Assuming the Firebase UID matches the staff ID
  const { date } = req.query; // e.g., ?date=2023-10-15
  if (!date) {
    return res.status(400).json({ error: "Date is required" });
  }
  try {
    const schedule = await query(
      `SELECT 
         a.appointment_id, 
         a.scheduled_time AS start_time,
         a.scheduled_time AS end_time,
         cu.full_name AS customer_name, 
         GROUP_CONCAT(s.custom_name SEPARATOR ', ') AS service_name
       FROM appointments a
       LEFT JOIN users cu ON a.user_id = cu.user_id
       LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
       LEFT JOIN services s ON aps.service_id = s.service_id
       WHERE a.staff_id = ? AND DATE(a.scheduled_time) = ?
       GROUP BY a.appointment_id`,
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
//U2: As a salon owner, I want to see customer visit histories so that I can provide personalized service
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

// Check if owner has a salon
exports.checkOwnerSalon = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const salons = await query(
      "SELECT * FROM salons WHERE owner_id = ? LIMIT 1",
      [userId]
    );

    if (salons && salons.length > 0) {
      const record = salons[0];
      const pickField = (...fields) => {
        for (const field of fields) {
          if (record[field] !== undefined && record[field] !== null) {
            return record[field];
          }
        }
        return null;
      };

      return res.json({
        hasSalon: true,
        salon: {
          salon_id: record.salon_id,
          name: pickField("name", "salon_name"),
          slug: pickField("slug", "salon_slug"),
          address: pickField("address", "street_address"),
          city: record.city ?? null,
          state: pickField("state", "region"),
          zip: pickField("zip", "postal_code"),
          country: record.country ?? null,
          phone: pickField("phone", "contact_number"),
          email: pickField("email", "contact_email"),
          website: record.website ?? null,
          description: pickField("description", "about"),
          profile_picture: pickField("profile_picture", "logo"),
          status: pickField("status", "salon_status"),
        },
      });
    }

    return res.json({ hasSalon: false });
  } catch (error) {
    console.error("Error checking owner salon:", error);
    res.status(500).json({ error: "Failed to check salon" });
  }
};

// Create/Register a new salon
exports.createSalon = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    // Check if user already has a salon
    const existingSalons = await query(
      "SELECT salon_id FROM salons WHERE owner_id = ? LIMIT 1",
      [userId]
    );

    if (existingSalons && existingSalons.length > 0) {
      return res.status(400).json({ error: "You already have a salon registered" });
    }

    const { 
      name,
      salon_name,
      address, 
      phone, 
      city, 
      state,
      zip,
      country,
      email, 
      website, 
      description 
    } = req.body;

    // Accept both 'name' and 'salon_name' fields from frontend
    const salonName = name || salon_name;

    // Validate required fields
    if (!salonName || !address || !phone) {
      return res.status(400).json({ 
        error: "Salon name, address, and phone are required" 
      });
    }

    // Generate a slug from the salon name
    const slug = salonName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Handle profile picture upload if provided
    let profilePicturePath = null;
    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      profilePicturePath = `/uploads/${file.filename}`;
    }

    // Insert the new salon
    const result = await query(
      `INSERT INTO salons 
       (owner_id, name, slug, address, city, state, zip, country, phone, email, website, description, profile_picture, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        salonName,
        slug,
        address,
        city || null,
        state || null,
        zip || null,
        country || null,
        phone,
        email || null,
        website || null,
        description || null,
        profilePicturePath,
      ]
    );

    return res.status(201).json({
      message: "Salon registered successfully",
      salon: {
        salon_id: result.insertId,
        salon_name: salonName,
        slug,
        address,
        city,
        state,
        zip,
        country,
        phone,
        email,
        website,
        description,
        profile_picture: profilePicturePath,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error("Error creating salon:", error);
    res.status(500).json({ error: "Failed to register salon" });
  }
};

// Get salon by ID (for settings view)
exports.getSalonById = async (req, res) => {
  try {
    const { salon_id } = req.params;
    const userId = req.user?.user_id;

    const salons = await query(
      "SELECT s.salon_id, s.name, s.slug, s.address, s.city, s.state, s.zip, s.country, s.phone, s.email, s.website, s.description, s.profile_picture, s.status, s.created_at, s.owner_id FROM salons s WHERE s.salon_id = ?",
      [salon_id]
    );

    if (!salons || salons.length === 0) {
      return res.status(404).json({ error: "Salon not found" });
    }

    const salon = salons[0];

    // Only owner can view full salon details
    if (salon.owner_id !== userId && req.user?.user_role !== 'admin') {
      return res.status(403).json({ error: "Not authorized to view this salon" });
    }

    return res.json(salon);
  } catch (error) {
    console.error("Error fetching salon:", error);
    res.status(500).json({ error: "Failed to fetch salon" });
  }
};

// Update salon settings
exports.updateSalon = async (req, res) => {
  try {
    const { salon_id } = req.params;
    const userId = req.user?.user_id;

    // Verify ownership
    const salons = await query(
      "SELECT owner_id FROM salons WHERE salon_id = ?",
      [salon_id]
    );

    if (!salons || salons.length === 0) {
      return res.status(404).json({ error: "Salon not found" });
    }

    if (salons[0].owner_id !== userId && req.user?.user_role !== 'admin') {
      return res.status(403).json({ error: "Not authorized to update this salon" });
    }

    const { 
      name,
      address, 
      phone, 
      city, 
      email, 
      website, 
      description 
    } = req.body;

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];

    if (name) {
      updates.push("name = ?");
      values.push(name);
      // Update slug when name changes
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      updates.push("slug = ?");
      values.push(slug);
    }
    if (address !== undefined) { updates.push("address = ?"); values.push(address); }
    if (city !== undefined) { updates.push("city = ?"); values.push(city); }
    if (state !== undefined) { updates.push("state = ?"); values.push(state); }
    if (zip !== undefined) { updates.push("zip = ?"); values.push(zip); }
    if (country !== undefined) { updates.push("country = ?"); values.push(country); }
    if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }
    if (website !== undefined) { updates.push("website = ?"); values.push(website); }
    if (description !== undefined) { updates.push("description = ?"); values.push(description); }

    // Handle profile picture if uploaded
    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      const profilePicturePath = `/uploads/${file.filename}`;
      updates.push("profile_picture = ?");
      values.push(profilePicturePath);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(salon_id);

    await query(
      `UPDATE salons SET ${updates.join(", ")} WHERE salon_id = ?`,
      values
    );

    // Fetch updated salon
    const updatedSalon = await query(
      "SELECT salon_id, name, slug, address, city, state, zip, country, phone, email, website, description, profile_picture, status FROM salons WHERE salon_id = ?",
      [salon_id]
    );

    return res.json({
      message: "Salon updated successfully",
      salon: updatedSalon[0]
    });
  } catch (error) {
    console.error("Error updating salon:", error);
    res.status(500).json({ error: "Failed to update salon" });
  }
};
