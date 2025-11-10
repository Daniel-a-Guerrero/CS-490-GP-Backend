// modules/analytics/service.js
const { db } = require("../../config/database");

// helpers
const parseDate = (s, fallback) => (s ? new Date(s) : fallback);
const dayMs = 24 * 60 * 60 * 1000;

// numeric casting helpers (MySQL DECIMAL/AVG/SUM often come back as strings)
const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const n2 = (v) => {
  const x = n(v);
  return Number.isFinite(x) ? Number(x.toFixed(2)) : 0;
};
const n4 = (v) => {
  const x = n(v);
  return Number.isFinite(x) ? Number(x.toFixed(4)) : 0;
};

async function getOverview({ salonId, start, end }) {
  // default to “current month”
  const now = new Date();
  const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const from = parseDate(start, startDefault);
  const to = parseDate(end, endDefault);

  // previous period (same length immediately before)
  const periodDays = Math.max(1, Math.ceil((to - from + 1) / dayMs));
  const prevEnd = new Date(from.getTime() - 1000);
  const prevStart = new Date(prevEnd.getTime() - periodDays * dayMs + 1000);

  const params = [salonId, from, to];
  const prevParams = [salonId, prevStart, prevEnd];

  // ---------- Total Revenue ----------
  // From orders (paid) + appointment-linked payments (completed).
  const [revRows] = await db.query(
    `
    SELECT
      COALESCE((
        SELECT SUM(o.total_amount)
        FROM orders o
        WHERE o.salon_id=? AND o.payment_status='paid' AND o.created_at BETWEEN ? AND ?
      ),0)
      +
      COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        JOIN appointments a ON a.appointment_id = p.appointment_id
        WHERE a.salon_id=? AND p.payment_status='completed' AND p.created_at BETWEEN ? AND ?
      ),0) AS revenue;
    `,
    [salonId, from, to, salonId, from, to]
  );

  const [revPrevRows] = await db.query(
    `
    SELECT
      COALESCE((
        SELECT SUM(o.total_amount)
        FROM orders o
        WHERE o.salon_id=? AND o.payment_status='paid' AND o.created_at BETWEEN ? AND ?
      ),0)
      +
      COALESCE((
        SELECT SUM(p.amount)
        FROM payments p
        JOIN appointments a ON a.appointment_id = p.appointment_id
        WHERE a.salon_id=? AND p.payment_status='completed' AND p.created_at BETWEEN ? AND ?
      ),0) AS revenue;
    `,
    [salonId, prevStart, prevEnd, salonId, prevStart, prevEnd]
  );

  // ---------- Appointments ----------
  const [[{ appts }]] = await db.query(
    `
    SELECT COUNT(*) AS appts
    FROM appointments
    WHERE salon_id=? AND status IN ('booked','completed')
      AND scheduled_time BETWEEN ? AND ?;
    `,
    params
  );
  const [[{ appts: apptsPrev }]] = await db.query(
    `
    SELECT COUNT(*) AS appts
    FROM appointments
    WHERE salon_id=? AND status IN ('booked','completed')
      AND scheduled_time BETWEEN ? AND ?;
    `,
    prevParams
  );

  // ---------- New Customers ----------
  // Customers who joined the salon in the period
  const [[{ new_customers }]] = await db.query(
    `
    SELECT COUNT(*) AS new_customers
    FROM salon_customers
    WHERE salon_id=? AND joined_at BETWEEN ? AND ?;
    `,
    params
  );
  const [[{ new_customers: new_customers_prev }]] = await db.query(
    `
    SELECT COUNT(*) AS new_customers
    FROM salon_customers
    WHERE salon_id=? AND joined_at BETWEEN ? AND ?;
    `,
    prevParams
  );

  // ---------- Average Rating ----------
  const [[{ avg_rating }]] = await db.query(
    `
    SELECT COALESCE(AVG(rating),0) AS avg_rating
    FROM reviews
    WHERE salon_id=? AND is_visible=1 AND created_at BETWEEN ? AND ?;
    `,
    params
  );
  const [[{ avg_rating: avg_rating_prev }]] = await db.query(
    `
    SELECT COALESCE(AVG(rating),0) AS avg_rating
    FROM reviews
    WHERE salon_id=? AND is_visible=1 AND created_at BETWEEN ? AND ?;
    `,
    prevParams
  );

  // ---------- Staff Utilization (MVP) ----------
  const [bookedRows] = await db.query(
    `
    SELECT COALESCE(SUM(s.duration),0) AS booked_minutes
    FROM appointments a
    JOIN services s ON s.service_id = a.service_id
    WHERE a.salon_id=? AND a.status IN ('booked','completed')
      AND a.scheduled_time BETWEEN ? AND ?;
    `,
    params
  );
  const bookedMinutes = n(bookedRows[0].booked_minutes);

  const [availability] = await db.query(
    `
    SELECT sa.staff_id, sa.day_of_week, sa.start_time, sa.end_time
    FROM staff_availability sa
    JOIN staff st ON st.staff_id = sa.staff_id
    WHERE st.salon_id=? AND sa.is_available=1;
    `,
    [salonId]
  );
  const [timeOff] = await db.query(
    `
    SELECT staff_id, start_datetime, end_datetime
    FROM staff_time_off
    WHERE status='approved' AND start_datetime <= ? AND end_datetime >= ?
      AND staff_id IN (SELECT staff_id FROM staff WHERE salon_id=?);
    `,
    [to, from, salonId]
  );

  // Expand days in range, compute available minutes by matching day_of_week
  const dayName = (d) =>
    ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
  let availableMinutes = 0;
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + dayMs)) {
    const dn = dayName(d);
    const dayAvail = availability.filter((a) => a.day_of_week === dn);
    for (const a of dayAvail) {
      const [sh, sm] = String(a.start_time).split(":").map(Number);
      const [eh, em] = String(a.end_time).split(":").map(Number);
      let start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm || 0, 0);
      let endt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em || 0, 0);
      let minutes = Math.max(0, (endt - start) / 60000);

      // subtract approved time-off overlaps
      for (const t of timeOff) {
        const overlapStart = Math.max(start.getTime(), new Date(t.start_datetime).getTime());
        const overlapEnd = Math.min(endt.getTime(), new Date(t.end_datetime).getTime());
        if (overlapEnd > overlapStart) {
          minutes -= (overlapEnd - overlapStart) / 60000;
        }
      }
      availableMinutes += Math.max(0, minutes);
    }
  }
  const staffUtilization = availableMinutes > 0 ? bookedMinutes / availableMinutes : 0;

  // ---------- Customer Retention (period repeaters) ----------
  const [[{ total_customers_period }]] = await db.query(
    `
    SELECT COUNT(DISTINCT a.user_id) AS total_customers_period
    FROM appointments a
    WHERE a.salon_id=? AND a.status IN ('booked','completed')
      AND a.scheduled_time BETWEEN ? AND ?;
    `,
    params
  );

  const lookbackStart = new Date(from.getTime() - 180 * dayMs);
  const [[{ retained_customers }]] = await db.query(
    `
    SELECT COUNT(DISTINCT a1.user_id) AS retained_customers
    FROM appointments a1
    WHERE a1.salon_id=? AND a1.status IN ('booked','completed')
      AND a1.scheduled_time BETWEEN ? AND ?
      AND EXISTS (
        SELECT 1
        FROM appointments a0
        WHERE a0.salon_id=a1.salon_id
          AND a0.user_id=a1.user_id
          AND a0.status IN ('booked','completed')
          AND a0.scheduled_time BETWEEN ? AND ?
      );
    `,
    [salonId, from, to, lookbackStart, new Date(from.getTime() - 1000)]
  );

  const retention =
    n(total_customers_period) > 0 ? n(retained_customers) / n(total_customers_period) : 0;

  // ---------- Pack result ----------
  return {
    period: { start: from, end: to },
    previousPeriod: { start: prevStart, end: prevEnd },

    totalRevenue: n(revRows[0]?.revenue),
    totalRevenuePrev: n(revPrevRows[0]?.revenue),

    appointments: n(appts),
    appointmentsPrev: n(apptsPrev),

    newCustomers: n(new_customers),
    newCustomersPrev: n(new_customers_prev),

    avgRating: n2(avg_rating),
    avgRatingPrev: n2(avg_rating_prev),

    staffUtilization: n4(staffUtilization),

    customerRetention: n4(retention),
  };
}



async function getRevenueSeries({ salonId, days = 7 }) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1), 0, 0, 0);

  // Orders + appointment payments per day (local date bucket)
  const [rows] = await db.query(
    `
    SELECT d.dt AS date,
           COALESCE(SUM(o_sum),0) + COALESCE(SUM(p_sum),0) AS total
    FROM (
      SELECT DATE(?) + INTERVAL seq DAY AS dt
      FROM (
        SELECT 0 seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
        UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
        UNION ALL SELECT 13 UNION ALL SELECT 14 UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18
        UNION ALL SELECT 19 UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
        UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29
      ) AS s
    ) d
    LEFT JOIN (
      SELECT DATE(created_at) AS day, SUM(total_amount) AS o_sum
      FROM orders
      WHERE salon_id=? AND payment_status='paid' AND created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
    ) o ON o.day = d.dt
    LEFT JOIN (
      SELECT DATE(p.created_at) AS day, SUM(p.amount) AS p_sum
      FROM payments p
      JOIN appointments a ON a.appointment_id = p.appointment_id
      WHERE a.salon_id=? AND p.payment_status='completed' AND p.created_at BETWEEN ? AND ?
      GROUP BY DATE(p.created_at)
    ) pay ON pay.day = d.dt
    WHERE d.dt BETWEEN DATE(?) AND DATE(?)
    GROUP BY d.dt
    ORDER BY d.dt;
    `,
    [start, salonId, start, end, salonId, start, end, start, end]
  );

  // Normalize to plain JS numbers/strings
  return rows.map(r => ({ date: r.date, total: Number(r.total || 0) }));
}

async function getServiceDistribution({ salonId, start, end }) {
  // default to last 30 days if not provided
  const to = end ? new Date(end) : new Date();
  const from = start ? new Date(start) : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 29, 0, 0, 0);

  // Count appointments by service category (fallback to service name if no category)
  const [rows] = await db.query(
    `
    SELECT
      COALESCE(sc.name, s.custom_name, CONCAT('Service ', s.service_id)) AS label,
      COUNT(*) AS count
    FROM appointments a
    JOIN services s ON s.service_id = a.service_id
    LEFT JOIN service_categories sc ON sc.category_id = s.category_id
    WHERE a.salon_id=? AND a.status IN ('booked','completed')
      AND a.scheduled_time BETWEEN ? AND ?
    GROUP BY label
    ORDER BY count DESC
    LIMIT 8; -- top 8 slices
    `,
    [salonId, from, to]
  );

  const total = rows.reduce((acc, r) => acc + Number(r.count || 0), 0) || 1;
  return rows.map(r => ({
    label: r.label,
    value: Number(r.count || 0),
    percent: Number(((Number(r.count || 0) / total) * 100).toFixed(2))
  }));
}

module.exports = { getOverview, getRevenueSeries, getServiceDistribution };