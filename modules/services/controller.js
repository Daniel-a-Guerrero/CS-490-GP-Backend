const { query } = require("../../config/database");

// Create a new service
exports.createService = async (req, res) => {
  try {
    const { salon_id, custom_name, category, duration, price } = req.body;

    if (!salon_id || !custom_name || !category || !duration || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Get or create category
    let [categories] = await query(
      'SELECT category_id FROM service_categories WHERE name = ?',
      [category]
    );
    
    let categoryId;
    if (categories.length === 0) {
      const [catResult] = await query(
        'INSERT INTO service_categories (name, description) VALUES (?, ?)',
        [category, category]
      );
      categoryId = catResult.insertId;
    } else {
      categoryId = categories[0].category_id;
    }

    // Create service
    const [result] = await query(
      `INSERT INTO services (salon_id, category_id, custom_name, duration, price, is_active) 
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [salon_id, categoryId, custom_name, duration, price]
    );

    res.status(201).json({ 
      message: "Service created successfully", 
      service_id: result.insertId 
    });
  } catch (error) {
    console.error("Create service error:", error);
    res.status(500).json({ error: "Failed to create service" });
  }
};

// Update a service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { custom_name, category, duration, price } = req.body;

    if (!custom_name || !category || !duration || !price) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Get or create category
    let [categories] = await query(
      'SELECT category_id FROM service_categories WHERE name = ?',
      [category]
    );
    
    let categoryId;
    if (categories.length === 0) {
      const [catResult] = await query(
        'INSERT INTO service_categories (name, description) VALUES (?, ?)',
        [category, category]
      );
      categoryId = catResult.insertId;
    } else {
      categoryId = categories[0].category_id;
    }

    // Update service
    await query(
      `UPDATE services 
       SET custom_name = ?, category_id = ?, duration = ?, price = ?
       WHERE service_id = ?`,
      [custom_name, categoryId, duration, price, id]
    );

    res.json({ message: "Service updated successfully" });
  } catch (error) {
    console.error("Update service error:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete by setting is_active to false
    await query(
      'UPDATE services SET is_active = FALSE WHERE service_id = ?',
      [id]
    );

    res.json({ message: "Service deleted successfully" });
  } catch (error) {
    console.error("Delete service error:", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
};

