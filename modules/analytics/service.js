// modules/analytics/service.js
const { db } = require("../../config/database");

// helpers
const parseDate = (s, fallback) => (s ? new Date(s) : fallback);
const dayMs = 24 * 60 * 60 * 1000;

const ACTIVE_STATUS_SQL = "'pending','confirmed','completed'";
const REVENUE_STATUS_SQL = "'confirmed','completed'";

async function resolveSalonStartDate(salonId) {
  const [[salonRow]] = await db.query(
    "SELECT COALESCE(created_at, updated_at) AS created_at FROM salons WHERE salon_id = ? LIMIT 1",
    [salonId]
  );
  const salonCreated = salonRow?.created_at ? new Date(salonRow.created_at) : null;

  const [[{ first_appt }]] = await db.query(
    "SELECT MIN(scheduled_time) AS first_appt FROM appointments WHERE salon_id = ?",
    [salonId]
  );
  const firstAppointment = first_appt ? new Date(first_appt) : null;

  const candidates = [salonCreated, firstAppointment]
    .filter(Boolean)
    .map((d) => d.getTime());

  if (!candidates.length) return null;
  return new Date(Math.min(...candidates));
}

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

async function getOverview({ salonId, start, end, range }) {
  // default to “current month”
  const now = new Date();
  const startDefault = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDefault = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  let from = parseDate(start, startDefault);
  const to = parseDate(end, endDefault);

  if (range === "lifetime" || start === "lifetime") {
    const lifetimeStart = await resolveSalonStartDate(salonId);
    if (lifetimeStart) {
      from = lifetimeStart;
    }
  }

  if (from > to) {
    from = new Date(to.getTime() - 7 * dayMs);
  }

  // previous period (same length immediately before)
  const periodDays = Math.max(1, Math.ceil((to - from + 1) / dayMs));
  const prevEnd = new Date(from.getTime() - 1000);
  const prevStart = new Date(prevEnd.getTime() - periodDays * dayMs + 1000);

  const params = [salonId, from, to];
  const prevParams = [salonId, prevStart, prevEnd];

  // ---------- Total Revenue ----------
  const [revRows] = await db.query(
    `
    SELECT COALESCE(SUM(a.price),0) AS revenue
    FROM appointments a
    WHERE a.salon_id=? AND a.status IN (${REVENUE_STATUS_SQL})
      AND a.scheduled_time BETWEEN ? AND ?;
    `,
    [salonId, from, to]
  );

  const [revPrevRows] = await db.query(
    `
    SELECT COALESCE(SUM(a.price),0) AS revenue
    FROM appointments a
    WHERE a.salon_id=? AND a.status IN (${REVENUE_STATUS_SQL})
      AND a.scheduled_time BETWEEN ? AND ?;
    `,
    [salonId, prevStart, prevEnd]
  );

  // ---------- Appointments ----------
  const [[{ appts }]] = await db.query(
    `
    SELECT COUNT(*) AS appts
    FROM appointments
    WHERE salon_id=? AND status IN (${ACTIVE_STATUS_SQL})
      AND scheduled_time BETWEEN ? AND ?;
    `,
    params
  );
  const [[{ appts: apptsPrev }]] = await db.query(
    `
    SELECT COUNT(*) AS appts
    FROM appointments
    WHERE salon_id=? AND status IN (${ACTIVE_STATUS_SQL})
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
    JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
    JOIN services s ON s.service_id = aps.service_id
    WHERE a.salon_id=? AND a.status IN (${ACTIVE_STATUS_SQL})
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
    WHERE a.salon_id=? AND a.status IN (${ACTIVE_STATUS_SQL})
      AND a.scheduled_time BETWEEN ? AND ?;
    `,
    params
  );

  const lookbackStart = new Date(from.getTime() - 180 * dayMs);
  const [[{ retained_customers }]] = await db.query(
    `
    SELECT COUNT(DISTINCT a1.user_id) AS retained_customers
    FROM appointments a1
    WHERE a1.salon_id=? AND a1.status IN (${ACTIVE_STATUS_SQL})
      AND a1.scheduled_time BETWEEN ? AND ?
      AND EXISTS (
        SELECT 1
        FROM appointments a0
        WHERE a0.salon_id=a1.salon_id
          AND a0.user_id=a1.user_id
          AND a0.status IN (${ACTIVE_STATUS_SQL})
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
  const start = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - (days - 1),
    0,
    0,
    0
  );

  const [rows] = await db.query(
    `
    SELECT d.dt AS date,
           COALESCE(SUM(appt_sum),0) AS total
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
      SELECT DATE(a.scheduled_time) AS day, SUM(a.price) AS appt_sum
      FROM appointments a
      WHERE a.salon_id=? AND a.status IN (${REVENUE_STATUS_SQL}) AND a.scheduled_time BETWEEN ? AND ?
      GROUP BY DATE(a.scheduled_time)
    ) appt ON appt.day = d.dt
    WHERE d.dt BETWEEN DATE(?) AND DATE(?)
    GROUP BY d.dt
    ORDER BY d.dt;
    `,
    [start, salonId, start, end, start, end]
  );

  return rows.map((r) => ({ date: r.date, total: Number(r.total || 0) }));
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
    JOIN appointment_services aps ON aps.appointment_id = a.appointment_id
    JOIN services s ON s.service_id = aps.service_id
    LEFT JOIN service_categories sc ON sc.category_id = s.category_id
    WHERE a.salon_id=? AND a.status IN (${ACTIVE_STATUS_SQL})
      AND a.scheduled_time BETWEEN ? AND ?
    GROUP BY s.service_id, label
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

function formatShortLabel(value) {
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
      new Date(value)
    );
  } catch {
    return String(value);
  }
}

function formatMonthLabel(value) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
      new Date(value)
    );
  } catch {
    return String(value);
  }
}

function bucketPeakHours(rows) {
  if (!rows || !rows.length) return [];
  const ranges = {};
  rows.forEach((row) => {
    const hour = Number(row.hour_slot);
    const bucket = Math.floor(hour / 2) * 2;
    const labelStart = bucket.toString().padStart(2, "0");
    const labelEnd = (bucket + 2).toString().padStart(2, "0");
    const key = `${labelStart}:00 - ${labelEnd}:00`;
    ranges[key] = (ranges[key] || 0) + Number(row.bookings || 0);
  });
  return Object.entries(ranges).map(([label, bookings]) => ({
    label,
    bookings: Number(bookings),
  }));
}

async function safe(promiseFactory, fallback) {
  try {
    return await promiseFactory();
  } catch (err) {
    console.error("analytics.safe query failed:", err);
    return fallback;
  }
}

async function getDashboardAnalytics({ salonId, days = 7 }) {
  const end = new Date();
  const start = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - (days - 1),
    0,
    0,
    0
  );

  const revenueSeriesRaw = await safe(
    () => getRevenueSeries({ salonId, days }),
    []
  );
  const bookingRows = await safe(
    () =>
      db.query(
        `
      SELECT
        DATE(a.scheduled_time) AS day,
        COUNT(*) AS total,
        SUM(CASE WHEN a.status = 'booked' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN a.status = 'booked' THEN 0 ELSE 0 END) AS pending,
        SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed
      FROM appointments a
      WHERE a.salon_id = ?
        AND a.scheduled_time BETWEEN ? AND ?
      GROUP BY day
      ORDER BY day;
      `,
        [salonId, start, end]
      ),
    [[]]
  );
  const peakRows = await safe(
    () =>
      db.query(
        `
      SELECT HOUR(a.scheduled_time) AS hour_slot, COUNT(*) AS bookings
      FROM appointments a
      WHERE a.salon_id = ?
        AND a.status IN (${ACTIVE_STATUS_SQL})
        AND a.scheduled_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY hour_slot
      ORDER BY hour_slot;
      `,
      [salonId]
    ),
    [[]]
  );
  const serviceRevenueRows = await safe(
    () =>
      db.query(
        `
      SELECT
        s.custom_name AS service,
        COUNT(*) AS bookings,
        COALESCE(SUM(aps.price), 0) AS revenue,
        COALESCE(AVG(aps.price), 0) AS avg_price
      FROM appointment_services aps
      JOIN appointments a ON a.appointment_id = aps.appointment_id
      JOIN services s ON s.service_id = aps.service_id
      WHERE a.salon_id = ?
        AND a.status IN (${REVENUE_STATUS_SQL})
        AND a.scheduled_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY s.service_id
      ORDER BY revenue DESC
      LIMIT 6;
      `,
      [salonId]
    ),
    [[]]
  );
  const serviceDistribution = await safe(
    () => getServiceDistribution({ salonId }),
    []
  );
  const staffRows = await safe(
    () =>
      db.query(
        `
      SELECT
        st.staff_id,
        u.full_name,
        COALESCE(SUM(CASE WHEN a.status IN (${REVENUE_STATUS_SQL}) THEN a.price ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN a.status IN (${REVENUE_STATUS_SQL}) THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN a.status IN (${ACTIVE_STATUS_SQL}) THEN 1 ELSE 0 END), 0) AS total,
        COALESCE(AVG(r.rating), 0) AS rating
      FROM staff st
      JOIN users u ON u.user_id = st.user_id
      LEFT JOIN appointments a ON a.staff_id = st.staff_id
      LEFT JOIN reviews r ON r.staff_id = st.staff_id
      WHERE st.salon_id = ?
      GROUP BY st.staff_id, u.full_name
      ORDER BY revenue DESC
      LIMIT 6;
      `,
      [salonId]
    ),
    [[]]
  );
  const retentionRows = await safe(
    () =>
      db.query(
        `
      SELECT ym, COUNT(*) AS customers, SUM(has_history) AS returning
      FROM (
        SELECT
          DATE_FORMAT(a.scheduled_time, '%Y-%m-01') AS ym,
          a.user_id,
          MAX(
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM appointments prev
                WHERE prev.salon_id = a.salon_id
                  AND prev.user_id = a.user_id
                  AND prev.status IN (${ACTIVE_STATUS_SQL})
                  AND prev.scheduled_time < STR_TO_DATE(DATE_FORMAT(a.scheduled_time, '%Y-%m-01'), '%Y-%m-%d')
              ) THEN 1 ELSE 0
            END
          ) AS has_history
        FROM appointments a
        WHERE a.salon_id = ?
          AND a.status IN (${ACTIVE_STATUS_SQL})
          AND a.scheduled_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY ym, a.user_id
      ) ranked
      GROUP BY ym
      ORDER BY ym;
      `,
        [salonId]
      ),
    [[]]
  );
  const growthRows = await safe(
    () =>
      db.query(
        `
      SELECT
        DATE_FORMAT(a.scheduled_time, '%Y-%m-01') AS ym,
        DATE_FORMAT(a.scheduled_time, '%b') AS month_label,
        COALESCE(SUM(CASE WHEN a.status IN (${REVENUE_STATUS_SQL}) THEN a.price ELSE 0 END), 0) AS revenue,
        COUNT(DISTINCT a.user_id) AS customers
      FROM appointments a
      WHERE a.salon_id = ?
        AND a.scheduled_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY ym, month_label
      ORDER BY ym;
      `,
      [salonId]
    ),
    [[]]
  );
  const customerTotalsRows = await safe(
    () =>
      db.query(
        `
      SELECT
        sc.user_id,
        COALESCE(SUM(CASE WHEN a.status IN (${REVENUE_STATUS_SQL}) THEN a.price ELSE 0 END), 0) AS total_spent,
        COALESCE(SUM(CASE WHEN a.status IN (${ACTIVE_STATUS_SQL}) THEN 1 ELSE 0 END), 0) AS visit_count
      FROM salon_customers sc
      LEFT JOIN appointments a
        ON a.user_id = sc.user_id
       AND a.salon_id = sc.salon_id
      WHERE sc.salon_id = ?
      GROUP BY sc.user_id;
      `,
      [salonId]
    ),
    [[]]
  );

  const revenueSeries = revenueSeriesRaw.map((point) => ({
    label: formatShortLabel(point.date),
    date: point.date,
    value: point.total,
  }));
  const totalRevenue = revenueSeries.reduce((sum, r) => sum + r.value, 0);
  const bookingData = bookingRows[0] || [];

  const bookingTrend = bookingData.map((row) => ({
    label: formatShortLabel(row.day),
    date: row.day,
    total: Number(row.total || 0),
  }));

  const totals = bookingData.reduce(
    (acc, row) => {
      acc.total += Number(row.total || 0);
      acc.confirmed += Number(row.confirmed || 0);
      acc.pending += Number(row.pending || 0);
      acc.cancelled += Number(row.cancelled || 0);
      acc.completed += Number(row.completed || 0);
      return acc;
    },
    { total: 0, confirmed: 0, pending: 0, cancelled: 0, completed: 0 }
  );

  const revenueSummary = {
    totalRevenue,
    avgTicket:
      totals.confirmed + totals.completed > 0
        ? totalRevenue / (totals.confirmed + totals.completed)
        : 0,
    dailyRevenue:
      revenueSeries.length > 0
        ? revenueSeries[revenueSeries.length - 1].value
        : 0,
    goalProgress: Math.min(
      100,
      ((totalRevenue || 0) / 5000) * 100
    ),
  };

  const peakHours = bucketPeakHours(peakRows[0]);

  const serviceRevenue = serviceRevenueRows[0].map((row) => ({
    service: row.service,
    revenue: Number(row.revenue || 0),
    bookings: Number(row.bookings || 0),
    average: Number(row.avg_price || 0),
  }));

  const serviceDistributionData = serviceDistribution.map((item) => ({
    name: item.label,
    value: Number(item.value || 0),
    percent: Number(item.percent || 0),
  }));

  const staffChart = staffRows[0].map((row) => ({
    name: row.full_name,
    revenue: Number(row.revenue || 0),
    rating: Number(row.rating || 0) * 20,
    efficiency:
      Number(row.total || 0) > 0
        ? Math.round((Number(row.completed || 0) / Number(row.total || 0)) * 100)
        : 0,
  }));

  const topPerformer =
    staffRows[0].slice().sort((a, b) => Number(b.revenue) - Number(a.revenue))[0] ||
    null;
  const highestRating =
    staffRows[0].slice().sort((a, b) => Number(b.rating) - Number(a.rating))[0] ||
    null;
  const mostEfficient =
    staffChart
      .slice()
      .sort((a, b) => b.efficiency - a.efficiency)[0] || null;

  const retentionChart = retentionRows[0].map((row) => {
    const retentionRate =
      Number(row.customers || 0) > 0
        ? Math.round(
            (Number(row.returning || 0) / Number(row.customers || 0)) * 100
          )
        : 0;
    return {
      ym: row.ym,
      month: formatMonthLabel(row.ym),
      retention: retentionRate,
      customers: Number(row.customers || 0),
    };
  });

  const latestRetention = retentionChart[retentionChart.length - 1] || {
    retention: 0,
    customers: 0,
  };

  const retentionLookup = new Map(
    retentionChart.map((item) => [item.ym, item.retention])
  );

  const growthChart = growthRows[0].map((row) => ({
    month: row.month_label,
    revenue: Number(row.revenue || 0),
    customers: Number(row.customers || 0),
    retention: retentionLookup.get(row.ym) || 0,
  }));

  const firstGrowth = growthChart[0] || {
    revenue: 0,
    customers: 0,
    retention: 0,
  };
  const lastGrowth = growthChart[growthChart.length - 1] || firstGrowth;

  const customerTotals = customerTotalsRows[0];
  const totalCustomers = customerTotals.length;
  const totalValue = customerTotals.reduce(
    (sum, row) => sum + Number(row.total_spent || 0),
    0
  );
  const totalVisits = customerTotals.reduce(
    (sum, row) => sum + Number(row.visit_count || 0),
    0
  );
  const avgLtv = totalCustomers > 0 ? totalValue / totalCustomers : 0;
  const avgVisits = totalCustomers > 0 ? totalVisits / totalCustomers : 0;

  const vipCustomers = customerTotals.filter(
    (row) => Number(row.total_spent || 0) >= 500
  );
  const regularCustomers = customerTotals.filter(
    (row) =>
      Number(row.total_spent || 0) >= 200 &&
      Number(row.total_spent || 0) < 500
  );
  const occasionalCustomers = customerTotals.filter(
    (row) => Number(row.total_spent || 0) < 200
  );

  const avgSpend = (list) =>
    list.length > 0
      ? list.reduce((sum, row) => sum + Number(row.total_spent || 0), 0) /
        list.length
      : 0;

  const customerValue = {
    avgLtv,
    avgVisitsPerYear: avgVisits,
    tiers: [
      { label: "VIP Customers", avg: avgSpend(vipCustomers) },
      { label: "Regular Customers", avg: avgSpend(regularCustomers) },
      { label: "Occasional Customers", avg: avgSpend(occasionalCustomers) },
    ],
    totalCustomerValue: totalValue,
    activeCustomers: totalCustomers,
  };

  return {
    revenue: {
      summary: revenueSummary,
      series: revenueSeries,
    },
    bookings: {
      trend: bookingTrend,
      totals,
    },
    peakHours,
    serviceRevenue,
    serviceDistribution: serviceDistributionData,
    staffPerformance: {
      chart: staffChart,
      highlights: {
        topPerformer: topPerformer
          ? {
              name: topPerformer.full_name,
              revenue: Number(topPerformer.revenue || 0),
            }
          : null,
        highestRating: highestRating
          ? {
              name: highestRating.full_name,
              rating: Number(highestRating.rating || 0),
            }
          : null,
        mostEfficient: mostEfficient
          ? {
              name: mostEfficient.name,
              efficiency: mostEfficient.efficiency,
            }
          : null,
      },
    },
    customerRetention: {
      chart: retentionChart,
      retentionRate: latestRetention.retention || 0,
      newCustomers: totals.total - totals.confirmed - totals.completed,
    },
    customerValue,
    growthOverview: {
      chart: growthChart,
      summary: {
        revenueGrowth:
          firstGrowth.revenue > 0
            ? ((lastGrowth.revenue - firstGrowth.revenue) /
                firstGrowth.revenue) *
              100
            : 0,
        customerGrowth:
          firstGrowth.customers > 0
            ? ((lastGrowth.customers - firstGrowth.customers) /
                firstGrowth.customers) *
              100
            : 0,
        retentionGrowth: lastGrowth.retention - firstGrowth.retention,
      },
    },
  };
}

module.exports = {
  getOverview,
  getRevenueSeries,
  getServiceDistribution,
  getDashboardAnalytics,
};
