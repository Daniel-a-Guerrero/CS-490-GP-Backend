const { db } = require("../../config/database");
const appointmentService = require("../appointments/service");

const ALLOWED_STATUSES = new Set([
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

const normalizeStatus = (status) => {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "canceled") return "cancelled";
  if (ALLOWED_STATUSES.has(normalized)) return normalized;
  return null;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const salonColumnCache = {};

async function hasSalonColumn(columnName) {
  if (salonColumnCache[columnName] !== undefined) {
    return salonColumnCache[columnName];
  }
  try {
    const [columns] = await db.query("SHOW COLUMNS FROM salons LIKE ?", [
      columnName,
    ]);
    salonColumnCache[columnName] = columns.length > 0;
    return salonColumnCache[columnName];
  } catch (err) {
    console.error("Failed to inspect salons table column:", columnName, err);
    salonColumnCache[columnName] = false;
    return false;
  }
}

const ensureActivityTable = (() => {
  let ensured = false;
  return async () => {
    if (ensured) return;
    await db.query(`
      CREATE TABLE IF NOT EXISTS appointment_activity (
        activity_id INT AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT NOT NULL,
        staff_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        from_status VARCHAR(50),
        to_status VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_appointment_activity_appointment_id (appointment_id),
        INDEX idx_appointment_activity_staff_id (staff_id)
      )
    `);
    ensured = true;
  };
})();

async function recordAppointmentActivity({
  appointmentId,
  staffId,
  action,
  fromStatus,
  toStatus,
  notes,
}) {
  await ensureActivityTable();
  await db.query(
    `
      INSERT INTO appointment_activity
        (appointment_id, staff_id, action, from_status, to_status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      appointmentId,
      staffId,
      action,
      fromStatus || null,
      toStatus || null,
      notes || null,
    ]
  );
}

async function getStaffProfile(staffId) {
  const hasSalonName = await hasSalonColumn("name");
  const hasLegacyName = await hasSalonColumn("salon_name");
  let salonNameExpr = "NULL";
  if (hasSalonName && hasLegacyName) {
    salonNameExpr = "COALESCE(sa.name, sa.salon_name)";
  } else if (hasSalonName) {
    salonNameExpr = "sa.name";
  } else if (hasLegacyName) {
    salonNameExpr = "sa.salon_name";
  }

  const salonSlugExpr = (await hasSalonColumn("slug")) ? "sa.slug" : "NULL";
  const salonCityExpr = (await hasSalonColumn("city")) ? "sa.city" : "NULL";
  const salonStateExpr = (await hasSalonColumn("state")) ? "sa.state" : "NULL";

  const [rows] = await db.query(
    `
      SELECT 
        s.staff_id,
        s.salon_id,
        s.staff_code,
        s.specialization,
        s.staff_role,
        s.staff_role_id,
        s.is_active,
        s.pin_last_set,
        sr.staff_role_name,
        ${salonNameExpr} AS salon_name,
        ${salonSlugExpr} AS salon_slug,
        ${salonCityExpr} AS salon_city,
        ${salonStateExpr} AS salon_state,
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.profile_pic
      FROM staff s
      JOIN users u ON s.user_id = u.user_id
      LEFT JOIN staff_roles sr ON sr.staff_role_id = s.staff_role_id
      LEFT JOIN salons sa ON sa.salon_id = s.salon_id
      WHERE s.staff_id = ?
      LIMIT 1
    `,
    [staffId]
  );

  if (!rows.length) {
    return null;
  }

  const staff = rows[0];
  return {
    staff_id: staff.staff_id,
    salon_id: staff.salon_id,
    staff_code: staff.staff_code,
    specialization: staff.specialization,
    staff_role: staff.staff_role_name || staff.staff_role,
    staff_role_id: staff.staff_role_id,
    is_active: Boolean(staff.is_active),
    pin_last_set: staff.pin_last_set,
    salon: {
      id: staff.salon_id,
      name: staff.salon_name,
      slug: staff.salon_slug,
      city: staff.salon_city,
      state: staff.salon_state,
    },
    user: {
      user_id: staff.user_id,
      full_name: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      profile_pic: staff.profile_pic,
    },
  };
}

async function getDashboardSummary(staffId, targetDate = new Date()) {
  const start = startOfDay(targetDate);
  const end = endOfDay(targetDate);

  const [[summary]] = await db.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS revenue_today
      FROM appointments
      WHERE staff_id = ?
        AND scheduled_time BETWEEN ? AND ?
    `,
    [staffId, start, end]
  );

  const [nextRows] = await db.query(
    `
      SELECT 
        a.appointment_id,
        a.scheduled_time,
        a.status,
        a.price,
        cu.full_name AS customer_name,
        cu.phone AS customer_phone,
        cu.email AS customer_email,
        GROUP_CONCAT(DISTINCT sv.custom_name ORDER BY sv.custom_name SEPARATOR ', ') AS services,
        COALESCE(SUM(sv.duration), 0) AS duration_minutes
      FROM appointments a
      LEFT JOIN users cu ON cu.user_id = a.user_id
      LEFT JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
      LEFT JOIN services sv ON aps.service_id = sv.service_id
      WHERE a.staff_id = ?
        AND a.status IN ('pending','confirmed')
        AND a.scheduled_time >= NOW()
      GROUP BY a.appointment_id
      ORDER BY a.scheduled_time ASC
      LIMIT 1
    `,
    [staffId]
  );

  const [recentRows] = await db.query(
    `
      SELECT 
        COUNT(*) AS total_completed,
        COALESCE(SUM(price), 0) AS revenue_completed
      FROM appointments
      WHERE staff_id = ?
        AND status = 'completed'
        AND scheduled_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `,
    [staffId]
  );

  const [[shiftBounds]] = await db.query(
    `
      SELECT 
        MIN(scheduled_time) AS first_slot,
        MAX(scheduled_time) AS last_slot
      FROM appointments
      WHERE staff_id = ?
        AND scheduled_time BETWEEN ? AND ?
    `,
    [staffId, start, end]
  );

  const pendingCount = Number(summary?.pending || 0);
  const confirmedCount = Number(summary?.confirmed || 0);
  const focusMessage =
    pendingCount > 0
      ? `Check in ${pendingCount} pending ${pendingCount === 1 ? "guest" : "guests"}`
      : confirmedCount > 0
      ? `Surprise ${confirmedCount} confirmed ${confirmedCount === 1 ? "guest" : "guests"}`
      : "Invite a new guest today";

  return {
    totals: {
      total: Number(summary?.total || 0),
      completed: Number(summary?.completed || 0),
      confirmed: Number(summary?.confirmed || 0),
      pending: Number(summary?.pending || 0),
      cancelled: Number(summary?.cancelled || 0),
      revenue_today: Number(summary?.revenue_today || 0),
    },
    upcoming: nextRows.length ? nextRows[0] : null,
    recent_performance: {
      completed: Number(recentRows?.[0]?.total_completed || 0),
      revenue: Number(recentRows?.[0]?.revenue_completed || 0),
    },
    shift: {
      start: shiftBounds?.first_slot || null,
      end: shiftBounds?.last_slot || null,
      focus: focusMessage,
    },
  };
}

function buildDateFilters(filters = {}) {
  const { date, from, to, range } = filters;
  let start = null;
  let end = null;

  const toDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  if (date) {
    const parsed = toDate(date);
    if (parsed) {
      start = startOfDay(parsed);
      end = endOfDay(parsed);
      return { start, end };
    }
  }

  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  if (fromDate && toDateValue) {
    start = startOfDay(fromDate);
    end = endOfDay(toDateValue);
    return { start, end };
  }

  const now = new Date();
  if (range === "upcoming") {
    start = now;
    end = null;
  } else if (range === "past") {
    start = null;
    end = now;
  } else {
    start = startOfDay(now);
    end = endOfDay(now);
  }

  return { start, end };
}

async function queryAppointments({
  scope,
  staffId,
  salonId,
  targetStaffId = null,
  status,
  date,
  from,
  to,
  range,
  limit = 20,
  offset = 0,
}) {
  if (scope === "staff" && !staffId) {
    throw new Error("staffId is required for staff scoped queries");
  }
  if (scope === "salon" && !salonId) {
    throw new Error("salonId is required for salon scoped queries");
  }

  const { start, end } = buildDateFilters({ date, from, to, range });
  const statuses = status
    ? String(status)
        .split(",")
        .map((s) => normalizeStatus(s))
        .filter(Boolean)
    : [];

  const where = [];
  const params = [];

  if (scope === "staff") {
    where.push("a.staff_id = ?");
    params.push(staffId);
  } else {
    where.push("a.salon_id = ?");
    params.push(salonId);
    if (targetStaffId) {
      where.push("a.staff_id = ?");
      params.push(targetStaffId);
    }
  }

  if (statuses.length) {
    where.push(`a.status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }

  if (start && end) {
    where.push("a.scheduled_time BETWEEN ? AND ?");
    params.push(start, end);
  } else if (start) {
    where.push("a.scheduled_time >= ?");
    params.push(start);
  } else if (end) {
    where.push("a.scheduled_time <= ?");
    params.push(end);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const selectParams = [...params, Number(limit), Number(offset)];
  const countParams = [...params];

  const [rows] = await db.query(
    `
      SELECT 
        a.appointment_id,
        a.scheduled_time,
        a.status,
        a.price,
        a.notes,
        a.staff_id,
        cu.full_name AS customer_name,
        cu.phone AS customer_phone,
        cu.email AS customer_email,
        su.full_name AS staff_name,
        GROUP_CONCAT(DISTINCT sv.custom_name ORDER BY sv.custom_name SEPARATOR ', ') AS services,
        COALESCE(SUM(sv.duration), 0) AS duration_minutes
      FROM appointments a
      LEFT JOIN users cu ON a.user_id = cu.user_id
      LEFT JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
      LEFT JOIN services sv ON aps.service_id = sv.service_id
      LEFT JOIN staff stf ON a.staff_id = stf.staff_id
      LEFT JOIN users su ON stf.user_id = su.user_id
      ${whereSql}
      GROUP BY a.appointment_id
      ORDER BY a.scheduled_time ASC
      LIMIT ? OFFSET ?
    `,
    selectParams
  );

  const [[countRow]] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM appointments a
      ${whereSql}
    `,
    countParams
  );

  return {
    records: rows,
    total: Number(countRow?.total || 0),
  };
}

async function listAppointments({
  staffId,
  salonId,
  status,
  date,
  from,
  to,
  range,
  limit = 20,
  offset = 0,
}) {
  return queryAppointments({
    scope: "staff",
    staffId,
    salonId,
    status,
    date,
    from,
    to,
    range,
    limit,
    offset,
  });
}

async function listSalonAppointments({
  salonId,
  targetStaffId = null,
  status,
  date,
  from,
  to,
  range,
  limit = 20,
  offset = 0,
}) {
  return queryAppointments({
    scope: "salon",
    salonId,
    targetStaffId,
    status,
    date,
    from,
    to,
    range,
    limit,
    offset,
  });
}

async function getAppointmentDetails(staffId, appointmentId, salonId = null) {
  const appointment = await appointmentService.getAppointmentById(
    appointmentId
  );
  if (!appointment) return null;

  const ownsAppointment = staffId && appointment.staff_id === staffId;
  const sameSalon = salonId && appointment.salon_id === salonId;
  if (!ownsAppointment && !sameSalon) return null;

  const services = await appointmentService.getAppointmentServices(
    appointmentId
  );
  return {
    ...appointment,
    services,
  };
}

async function updateAppointmentStatus(
  staffId,
  salonId,
  appointmentId,
  status,
  notes
) {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    const error = new Error("Invalid appointment status");
    error.code = "INVALID_STATUS";
    throw error;
  }

  const [rows] = await db.query(
    `SELECT staff_id, salon_id, status FROM appointments WHERE appointment_id = ? LIMIT 1`,
    [appointmentId]
  );
  if (!rows.length) return null;
  const appointment = rows[0];

  if (salonId && appointment.salon_id !== salonId) {
    const error = new Error("Forbidden");
    error.code = "FORBIDDEN";
    throw error;
  }

  const sqlParts = [
    "UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP",
  ];
  const values = [normalized];

  if (typeof notes === "string") {
    sqlParts.push(", notes = ?");
    values.push(notes);
  }

  values.push(appointmentId);
  const sql = `${sqlParts.join(" ")} WHERE appointment_id = ?`;
  await db.query(sql, values);

  await recordAppointmentActivity({
    appointmentId,
    staffId,
    action: "status_change",
    fromStatus: appointment.status,
    toStatus: normalized,
    notes,
  });

  return getAppointmentDetails(appointment.staff_id, appointmentId, salonId);
}

async function listTopCustomers({
  salonId,
  staffId,
  scope = "staff",
  limit = 6,
}) {
  if (!salonId) return [];

  const conditions = ["a.salon_id = ?"];
  const params = [salonId];

  if (scope !== "salon" && staffId) {
    conditions.push("a.staff_id = ?");
    params.push(staffId);
  }

  const whereClause = conditions.join(" AND ");

  const [rows] = await db.query(
    `
      SELECT
        u.user_id,
        u.full_name,
        u.email,
        u.phone,
        COUNT(a.appointment_id) AS visits,
        MAX(a.scheduled_time) AS last_visit,
        COALESCE(SUM(a.price), 0) AS lifetime_value,
        SUBSTRING_INDEX(
          GROUP_CONCAT(DISTINCT sv.custom_name ORDER BY sv.custom_name SEPARATOR ','),
          ',',
          1
        ) AS favorite_service
      FROM appointments a
      JOIN users u ON u.user_id = a.user_id
      LEFT JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
      LEFT JOIN services sv ON sv.service_id = aps.service_id
      WHERE ${whereClause}
      GROUP BY u.user_id
      HAVING visits > 0
      ORDER BY visits DESC, last_visit DESC
      LIMIT ?
    `,
    [...params, limit]
  );

  return rows.map((row) => ({
    user_id: row.user_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    visits: Number(row.visits || 0),
    last_visit: row.last_visit,
    lifetime_value: Number(row.lifetime_value || 0),
    favorite_service: row.favorite_service || null,
  }));
}

async function listRetailHighlights({ salonId, limit = 4 }) {
  if (!salonId) return [];

  const [[appointmentStats]] = await db.query(
    `
      SELECT COUNT(*) AS total_completed
      FROM appointments
      WHERE salon_id = ?
        AND status IN ('confirmed','completed')
        AND scheduled_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `,
    [salonId]
  );

  const totalAppointments30d = Number(appointmentStats?.total_completed || 0);

  const [rows] = await db.query(
    `
      SELECT
        p.product_id,
        p.name,
        p.category AS category,
        p.description,
        p.price,
        p.stock,
        COALESCE(
          SUM(
            CASE
              WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              THEN oi.quantity
              ELSE 0
            END
          ),
          0
        ) AS units_30d
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.product_id
      LEFT JOIN orders o ON o.order_id = oi.order_id
      WHERE p.salon_id = ?
        AND (p.is_active IS NULL OR p.is_active = TRUE)
      GROUP BY p.product_id
      ORDER BY units_30d DESC, p.stock DESC, p.name ASC
      LIMIT ?
    `,
    [salonId, limit]
  );

  return rows.map((row) => {
    const attachRate =
      totalAppointments30d > 0
        ? Math.round((Number(row.units_30d || 0) / totalAppointments30d) * 100)
        : 0;

    return {
      product_id: row.product_id,
      name: row.name,
      brand: row.category || row.name,
      category: row.category || null,
      description: row.description,
      price: Number(row.price || 0),
      stock: Number(row.stock || 0),
      units_30d: Number(row.units_30d || 0),
      attach_rate: attachRate,
    };
  });
}

async function listTeamMembers({ salonId, limit = 3 }) {
  if (!salonId) return [];

  const [rows] = await db.query(
    `
      SELECT
        st.staff_id,
        st.salon_id,
        st.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.profile_pic,
        st.specialization,
        st.is_active,
        COALESCE(sr.staff_role_name, st.staff_role) AS staff_role,
        COALESCE(AVG(r.rating), 0) AS avg_rating,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS completed_total,
        COALESCE(SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END), 0) AS revenue_total
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN staff_roles sr ON sr.staff_role_id = st.staff_role_id
      LEFT JOIN reviews r ON r.staff_id = st.staff_id
      LEFT JOIN appointments a ON a.staff_id = st.staff_id
      WHERE st.salon_id = ?
        AND st.is_active = 1
      GROUP BY st.staff_id
      ORDER BY avg_rating DESC, revenue_total DESC
      LIMIT ?
    `,
    [salonId, limit]
  );

  return rows.map((row) => ({
    staff_id: row.staff_id,
    salon_id: row.salon_id,
    user_id: row.user_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    avatar_url: row.profile_pic,
    specialization: row.specialization,
    staff_role: row.staff_role,
    is_active: Boolean(row.is_active),
    avg_rating: Number(row.avg_rating || 0),
    total_revenue: Number(row.revenue_total || 0),
    completed_total: Number(row.completed_total || 0),
  }));
}

module.exports = {
  getStaffProfile,
  getDashboardSummary,
  listAppointments,
  listSalonAppointments,
  getAppointmentDetails,
  updateAppointmentStatus,
  normalizeStatus,
  listTopCustomers,
  listRetailHighlights,
  listTeamMembers,
};
