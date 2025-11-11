const { db } = require("../../config/database");

async function createSalon({ ownerId, name, address, description, phone, city, email, website, profile_picture }) {
  const [result] = await db.query(
    `INSERT INTO salons (owner_id, name, address, description, phone, email, website, profile_picture, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [ownerId, name, address, description, phone || null, email || null, website || null, profile_picture || null]
  );
  
  const salonId = result.insertId;
  
  // Create default salon settings
  try {
    await db.query("INSERT INTO salon_settings (salon_id) VALUES (?)", [salonId]);
  } catch (err) {
    console.log("salon_settings table doesn't exist, skipping...");
  }
  
  // Create audit log entry
  try {
    await db.query(
      "INSERT INTO salon_audit (salon_id, event_type, event_note, performed_by) VALUES (?, ?, ?, ?)",
      [salonId, "CREATED", "Salon registered by owner", ownerId]
    );
  } catch (err) {
    console.log("salon_audit table doesn't exist, skipping...");
  }
  
  // Add default staff, services, and availability
  try {
    // Create default staff roles
    const defaultRoles = ['Stylist', 'Hair Stylist', 'Colorist', 'Technician', 'Nail Artist', 'Receptionist', 'Barber'];
    for (const roleName of defaultRoles) {
      try {
        await db.query(
          'INSERT INTO staff_roles (salon_id, staff_role_name) VALUES (?, ?)',
          [salonId, roleName]
        );
      } catch (roleErr) {
        console.log(`Failed to create role ${roleName}:`, roleErr.message);
      }
    }
    console.log(`Created default staff roles for salon ${salonId}`);
    
    // Add owner as staff member
    const [staffResult] = await db.query(
      `INSERT INTO staff (user_id, salon_id, role, specialization, is_active) 
       VALUES (?, ?, 'manager', 'All Services', TRUE)`,
      [ownerId, salonId]
    );
    console.log(`Created staff member for salon ${salonId}`);
    
    // Add default services
    const defaultServices = [
      { name: 'Haircut', category: 'Haircuts', duration: 30, price: 35.00 },
      { name: 'Hair Coloring', category: 'Hair Coloring', duration: 90, price: 80.00 },
      { name: 'Manicure', category: 'Nails', duration: 45, price: 30.00 },
      { name: 'Pedicure', category: 'Nails', duration: 60, price: 45.00 },
      { name: 'Facial', category: 'Skincare', duration: 60, price: 75.00 },
    ];
    
    for (const service of defaultServices) {
      try {
        let [categories] = await db.query(
          'SELECT category_id FROM service_categories WHERE name = ?',
          [service.category]
        );
        
        let categoryId;
        if (categories.length === 0) {
          const [catResult] = await db.query(
            'INSERT INTO service_categories (name, description) VALUES (?, ?)',
            [service.category, service.category]
          );
          categoryId = catResult.insertId;
        } else {
          categoryId = categories[0].category_id;
        }
        
        await db.query(
          `INSERT INTO services (salon_id, category_id, custom_name, duration, price, is_active) 
           VALUES (?, ?, ?, ?, ?, TRUE)`,
          [salonId, categoryId, service.name, service.duration, service.price]
        );
      } catch (serviceErr) {
        console.log(`Failed to create service ${service.name}:`, serviceErr.message);
      }
    }
    console.log(`Created default services for salon ${salonId}`);
    
    // Create staff availability (Mon-Fri 9am-5pm)
    const staffId = staffResult.insertId;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    for (const day of days) {
      try {
        await db.query(
          `INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, is_available) 
           VALUES (?, ?, '09:00:00', '17:00:00', TRUE)`,
          [staffId, day]
        );
      } catch (availErr) {
        console.log(`Failed to create availability for ${day}:`, availErr.message);
      }
    }
    console.log(`Created staff availability for salon ${salonId}`);
    
  } catch (seedErr) {
    console.error('Error setting up salon:', seedErr.message);
  }
  
  const [rows] = await db.query("SELECT * FROM salons WHERE salon_id = ?", [salonId]);
  return rows[0];
}

async function getSalons({ q, page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  let sql =
    'SELECT s.*, u.full_name as owner_name FROM salons s JOIN users u ON u.user_id = s.owner_id WHERE s.status = "active"';
  const params = [];
  if (q) {
    sql += " AND (s.name LIKE ? OR s.description LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit, 10), parseInt(offset, 10));
  const [rows] = await db.query(sql, params);
  return rows;
}

module.exports = { createSalon, getSalons };
