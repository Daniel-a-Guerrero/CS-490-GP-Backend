const { db } = require("../../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

exports.totalStaff = async (s_id) => {
  const [rows] = await db.query(
    `SELECT COUNT(staff_id) as total FROM staff WHERE salon_id = ?`,
    [s_id]
  );
  return rows.length ? rows[0].total : 0;
};

exports.staffReviews = async (s_id) => {
  const [rows] = await db.query(
    `SELECT AVG(rating) as avgRating 
     FROM reviews 
     WHERE staff_id IS NOT NULL AND salon_id=?`,
    [s_id]
  );
  return rows.length ? rows[0].avgRating : 0;
};

exports.staffFiltered = async (salon_id, queries = {}) => {
  let sqlS = `
    SELECT 
      st.staff_id,
      u.full_name,
      u.phone,
      u.email,
      u.profile_pic AS avatar_url,            
      st.specialization, 
      st.is_active, 
      st.staff_code,
      COALESCE(sr.staff_role_name, st.staff_role) AS staff_role,
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(r.rating) AS review_count         
    FROM staff st 
    JOIN users u ON u.user_id = st.user_id
    LEFT JOIN reviews r ON r.staff_id = st.staff_id
    LEFT JOIN staff_roles sr ON sr.staff_role_id = st.staff_role_id
    WHERE st.salon_id = ? 
  `;

  const params = [Number(salon_id)];

  if (queries.name) {
    sqlS += ` AND u.full_name LIKE ? `;
    params.push(`%${queries.name}%`);
  }

  if (typeof queries.is_active !== "undefined") {
    const val =
      queries.is_active === "true" || queries.is_active === true ? 1 : 0;
    sqlS += ` AND st.is_active = ? `;
    params.push(val);
  }

  if (queries.specialty) {
    sqlS += ` AND st.specialization LIKE ? `;
    params.push(`%${queries.specialty}%`);
  }

  sqlS += ` GROUP BY st.staff_id `;

  if (queries.rating) {
    sqlS += ` HAVING AVG(r.rating) >= ? `;
    params.push(Number(queries.rating));
  }

  if (queries.order) {
    if (queries.order === "name") sqlS += ` ORDER BY u.full_name `;
    else if (queries.order === "rating") sqlS += ` ORDER BY avg_rating `;
    if (queries.aOrD?.toLowerCase() === "d") sqlS += ` DESC `;
    else sqlS += ` ASC `;
  }

  const limit = parseInt(queries.limit, 10) || 50;
  const page = Math.max(parseInt(queries.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  sqlS += ` LIMIT ? OFFSET ? `;
  params.push(limit, offset);

  const [rows] = await db.query(sqlS, params);
  return rows;
};

exports.staffEfficiency = async (id, salon_id) => {
  const [rows] = await db.query(
    `SELECT s.staff_id, u.full_name,
       COALESCE(SUM(svc.duration),0) AS total_service_minutes,
       COALESCE(SUM(TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time)),0) AS total_available_minutes,
       ROUND(
         COALESCE(SUM(svc.duration),0) / NULLIF(COALESCE(SUM(TIMESTAMPDIFF(MINUTE, sa.start_time, sa.end_time)),0),0) * 100,
         2
     ) AS efficiency_percentage
    FROM staff s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN staff_availability sa ON s.staff_id = sa.staff_id
    LEFT JOIN appointments a ON s.staff_id = a.staff_id AND a.status = 'completed'
    LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
    LEFT JOIN services svc ON aps.service_id = svc.service_id
    WHERE s.staff_id = ? AND s.salon_id = ?
    GROUP BY s.staff_id`,
    [id, salon_id]
  );
  if (!rows.length) {
    return {
      staff_id: id,
      total_service_minutes: 0,
      total_available_minutes: 0,
      efficiency_percentage: 0,
    };
  }
  const r = rows[0];
  return {
    staff_id: r.staff_id,
    full_name: r.full_name,
    total_service_minutes: Number(r.total_service_minutes) || 0,
    total_available_minutes: Number(r.total_available_minutes) || 0,
    efficiency_percentage: Number(r.efficiency_percentage) || 0,
  };
};

exports.averageEfficiency = async (salon_id) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const [rows] = await db.query(
    `
      SELECT ROUND(
        SUM(CASE WHEN total_work_minutes>0 THEN total_service_minutes/total_work_minutes ELSE 0 END * total_work_minutes)
        / NULLIF(SUM(total_work_minutes),0) * 100, 2
      ) AS weighted_avg_efficiency
      FROM (
        SELECT s.staff_id,
              COALESCE(SUM(svc.duration),0) AS total_service_minutes,
              COALESCE(SUM(TIMESTAMPDIFF(MINUTE, sa.checkin_time, sa.checkout_time)),0) AS total_work_minutes
        FROM staff s
        LEFT JOIN appointments a ON a.staff_id = s.staff_id AND a.status = 'completed'
        LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id AND MONTH(a.scheduled_time)=? AND YEAR(a.scheduled_time)=?
        LEFT JOIN services svc ON aps.service_id = svc.service_id
        LEFT JOIN staff_attendance sa ON sa.staff_id = s.staff_id AND MONTH(sa.checkin_time)=? AND YEAR(sa.checkin_time)=?
        WHERE s.salon_id = ?
        GROUP BY s.staff_id
      ) t
    `,
    [currentMonth, currentYear, currentMonth, currentYear, salon_id]
  );

  if (!rows.length) return { weighted_avg_efficiency: 0 };
  return {
    weighted_avg_efficiency: Number(rows[0].weighted_avg_efficiency) || 0,
  };
};

exports.staffRevenue = async (id, filters = {}) => {
  let sq = `
    SELECT s.staff_id, COALESCE(SUM(p.amount), 0) as total_revenue, COUNT(DISTINCT a.appointment_id) AS appointments_count 
    FROM staff s
    LEFT JOIN appointments a on a.staff_id=s.staff_id 
    LEFT JOIN payments p on p.appointment_id=a.appointment_id
    WHERE s.staff_id=? AND a.status='completed' AND p.payment_status='completed'
  `;
  const params = [id];
  if (filters.startDate) {
    sq += ` AND a.scheduled_time >= ?`;
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    sq += ` AND a.scheduled_time <= ?`;
    params.push(filters.endDate);
  }
  sq += ` GROUP BY s.staff_id `;
  const [rows] = await db.query(sq, params);
  if (!rows.length)
    return { staff_id: id, total_revenue: 0, appointments_count: 0 };
  return rows[0];
};

// ------------------------ NEW STAFF LOGIN + PIN SYSTEM ------------------------

/** Generate unique 4-digit staff code */
async function generateStaffCode() {
  let code, exists;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    const [rows] = await db.query(
      "SELECT staff_id FROM staff WHERE staff_code = ?",
      [code]
    );
    exists = rows.length > 0;
  } while (exists);
  return code;
}

/** Add staff (auto-assigns staff_code + retry on duplicate) */
exports.addStaff = async (
  salon,
  user,
  staff_role,
  staff_role_id,
  specialization
) => {
  const staffCode = await generateStaffCode();
  try {
    const [result] = await db.query(
      `INSERT INTO staff (salon_id, user_id, staff_role, staff_role_id, specialization, staff_code, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        salon,
        user,
        staff_role || "staff",
        staff_role_id || null,
        specialization || null,
        staffCode,
      ]
    );
    return {
      insertId: result.insertId,
      staffCode,
      affectedRows: result.affectedRows,
    };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      // Rare collision, retry once
      return exports.addStaff(
        salon,
        user,
        staff_role,
        staff_role_id,
        specialization
      );
    }
    throw err;
  }
};

/** Save token for staff PIN setup link */
exports.savePinSetupToken = async (staffId, token) => {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
  await db.query(
    `INSERT INTO staff_pin_tokens (staff_id, token, expires_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE token=VALUES(token), expires_at=VALUES(expires_at)`,
    [staffId, token, expiresAt]
  );
};

/** Set PIN after onboarding */
exports.setStaffPin = async (token, pin) => {
  const [rows] = await db.query(
    `SELECT staff_id, expires_at FROM staff_pin_tokens WHERE token=?`,
    [token]
  );
  if (!rows.length) throw new Error("Invalid or expired token");

  const { staff_id, expires_at } = rows[0];
  if (new Date(expires_at) < new Date()) throw new Error("Token expired");

  const pinHash = await bcrypt.hash(pin, 10);
  await db.query(
    `UPDATE staff SET pin_hash=?, pin_last_set=NOW() WHERE staff_id=?`,
    [pinHash, staff_id]
  );
  await db.query(`DELETE FROM staff_pin_tokens WHERE staff_id=?`, [staff_id]);
  return { success: true };
};

/** Verify staff login via staff_code + PIN (includes user_id for JWT) */
exports.verifyStaffLogin = async (staffCode, pin) => {
  const [rows] = await db.query(
    `SELECT staff_id, salon_id, user_id, pin_hash 
     FROM staff 
     WHERE staff_code=? AND is_active=1`,
    [staffCode]
  );
  if (!rows.length) throw new Error("Invalid staff code");

  const staff = rows[0];
  const valid = await bcrypt.compare(pin, staff.pin_hash || "");
  if (!valid) throw new Error("Invalid PIN");

  return {
    staff_id: staff.staff_id,
    salon_id: staff.salon_id,
    user_id: staff.user_id, // included for future JWT payload
  };
};

/** Optional: Reset PIN */
exports.resetStaffPin = async (staffId, newPin) => {
  const pinHash = await bcrypt.hash(newPin, 10);
  await db.query(
    `UPDATE staff SET pin_hash=?, pin_last_set=NOW() WHERE staff_id=?`,
    [pinHash, staffId]
  );
  return { success: true };
};

/** Edit staff */
exports.editStaff = async (
  staff_id,
  salon_id,
  user_id,
  staff_role,
  staff_role_id,
  specialization,
  full_name,
  phone,
  email
) => {
  const finalRoleId =
    staff_role_id && Number(staff_role_id) > 0 ? staff_role_id : null;

  // Begin a transaction so both updates succeed together
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Update staff table
    await conn.query(
      `UPDATE staff 
       SET salon_id=?, staff_role=?, staff_role_id=?, specialization=? 
       WHERE staff_id=?`,
      [salon_id, staff_role, finalRoleId, specialization, staff_id]
    );

    // 2️Update users table (if fields provided)
    await conn.query(
      `UPDATE users 
       SET full_name=?, phone=?, email=? 
       WHERE user_id=?`,
      [full_name, phone, email, user_id]
    );

    await conn.commit();
    conn.release();
    return { success: true };
  } catch (err) {
    await conn.rollback();
    conn.release();
    throw err;
  }
};

/** Delete staff */
exports.deleteStaff = async (staff_id) => {
  // First, check existence
  const [existing] = await db.query(
    "SELECT staff_id FROM staff WHERE staff_id = ?",
    [staff_id]
  );
  if (!existing.length) throw new Error("Staff not found");

  // Then delete staff record
  const [result] = await db.query("DELETE FROM staff WHERE staff_id = ?", [
    staff_id,
  ]);

  return { success: result.affectedRows > 0 };
};

exports.getStaffBySalon = async (salonId) => {
  const [rows] = await db.query(
    `
    SELECT 
      s.staff_id,
      s.salon_id,
      s.user_id,
      sr.staff_role_name AS staff_role,
      s.specialization,
      s.is_active,
      u.full_name,
      u.email,
      u.phone,

      -- Average rating and review count
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(r.review_id) AS review_count,

      -- Monthly revenue for this staff
      COALESCE(SUM(
        CASE 
          WHEN a.status = 'completed'
           AND MONTH(a.scheduled_time) = MONTH(CURRENT_DATE())
           AND YEAR(a.scheduled_time) = YEAR(CURRENT_DATE())
          THEN a.price ELSE 0 END
      ), 0) AS total_revenue,

      -- Efficiency (completed / total appointments)
      COALESCE(
        ROUND(
          (SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) /
          NULLIF(COUNT(a.appointment_id), 0)) * 100,
          1
        ),
      0) AS efficiency_percentage

    FROM staff s
    JOIN users u ON s.user_id = u.user_id
    LEFT JOIN staff_roles sr ON sr.staff_role_id = s.staff_role_id
    LEFT JOIN reviews r ON r.staff_id = s.staff_id
    LEFT JOIN appointments a ON a.staff_id = s.staff_id
    WHERE s.salon_id = ?
    GROUP BY s.staff_id
    ORDER BY u.full_name ASC;
    `,
    [salonId]
  );

  return rows;
};
