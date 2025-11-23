//bookings/service.js
const { db } = require("../../config/database");

exports.getAvailableBarbersAndSlots = async () => {
  const [barbers] = await db.query(
    `SELECT staff.staff_id, users.full_name, staff.specialization, staff.salon_id
     FROM staff 
     JOIN users ON staff.user_id = users.user_id
     WHERE staff.role = 'barber' AND staff.is_active = TRUE`
  );

  const today = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }

  let allSlots = [];
  for (const barber of barbers) {
    const barberSlots = [];

    for (const day of days) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = dayNames[day.getDay()];
      const [avails] = await db.query(
        `SELECT * FROM staff_availability WHERE staff_id = ? AND day_of_week = ? AND is_available = TRUE`,
        [barber.staff_id, dayName]
      );
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      
      const [timeoffs] = await db.query(
        `SELECT * FROM staff_time_off WHERE staff_id = ? AND status = 'approved' AND 
         ((start_datetime <= ? AND end_datetime >= ?) OR (start_datetime >= ? AND start_datetime <= ?))`,
        [
          barber.staff_id,
          day,
          day,
          day,
          nextDay,
        ]
      );
      const [apps] = await db.query(
        `SELECT * FROM appointments WHERE staff_id = ? AND status = 'booked' 
         AND scheduled_time BETWEEN ? AND ?`,
        [barber.staff_id, day, nextDay]
      );
      for (const avail of avails) {
        const startTimeParts = avail.start_time.split(":");
        const startHour = parseInt(startTimeParts[0]);
        const startMin = parseInt(startTimeParts[1]);
        
        const endTimeParts = avail.end_time.split(":");
        const endHour = parseInt(endTimeParts[0]);
        const endMin = parseInt(endTimeParts[1]);

        const start = new Date(day);
        start.setHours(startHour, startMin, 0);

        const end = new Date(day);
        end.setHours(endHour, endMin, 0);

      let slot = new Date(start);

      while (slot < end) {
        const slotEnd = new Date(slot.getTime() + 30 * 60000);

        let blocked = false;
        for (let i = 0; i < timeoffs.length; i++) {
          const t = timeoffs[i];
          if (new Date(t.start_datetime) < slotEnd && new Date(t.end_datetime) > slot) {
            blocked = true;
            break;
          }
        }

        let booked = false;
        for (let i = 0; i < apps.length; i++) {
          const a = apps[i];
          if (new Date(a.scheduled_time) <= slot && new Date(a.scheduled_time).getTime() + 30 * 60000 > slot.getTime()) {
            booked = true;
            break;
          }
        }

        if (!blocked && !booked && slotEnd <= end) {
          const dateStr = day.toISOString().split("T")[0];
          const timeStr = slot.toTimeString();
          const startTime = timeStr.substring(0, 5);
          const endTimeStr = slotEnd.toTimeString();
          const endTime = endTimeStr.substring(0, 5);
          
          barberSlots.push({
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
          });
        }

        slot = slotEnd;
      }
      }
    }

    allSlots.push({
      barber_id: barber.staff_id,
      barber_name: barber.full_name,
      salon_id: barber.salon_id,
      slots: barberSlots,
    });
  }

  return allSlots;
};

exports.checkSlotAvailability = async (staff_id, scheduled_time) => {
  // Check if there's already a booked appointment at this time
  const [count] = await db.query(
    `SELECT COUNT(*) as count FROM appointments 
     WHERE staff_id = ? AND status = 'booked' AND scheduled_time = ?`,
    [staff_id, scheduled_time]
  );
  // Also check for time off that overlaps
  const [timeoffCount] = await db.query(
    `SELECT COUNT(*) as count FROM staff_time_off 
     WHERE staff_id = ? AND status = 'approved' 
     AND start_datetime <= ? AND end_datetime >= ?`,
    [staff_id, scheduled_time, scheduled_time]
  );
  
  if (count[0].count === 0 && timeoffCount[0].count === 0) {
    return true;
  }
  return false;
};

exports.bookAppointment = async (user_id, salon_id, staff_id, service_id, scheduled_time) => {
  // Validate user_id
  if (!user_id || user_id === null || user_id === undefined) {
    throw new Error("User ID is required");
  }
  
  const result = await db.query(
    `INSERT INTO appointments (user_id, salon_id, staff_id, scheduled_time, status)
     VALUES (?, ?, ?, ?, 'booked')`,
    [user_id, salon_id, staff_id, scheduled_time]
  );
  // MySQL2 returns [result, fields] where result has insertId
  const insertResult = Array.isArray(result) ? result[0] : result;
  if (insertResult && insertResult.insertId) {
    const appointmentId = insertResult.insertId;

    if (service_id) {
      // add entry in appointment_services for pricing/duration
      const [svc] = await db.query(
        "SELECT duration, price FROM services WHERE service_id = ?",
        [service_id]
      );
      await db.query(
        `
        INSERT INTO appointment_services (appointment_id, service_id, duration, price)
        VALUES (?, ?, ?, ?)
        `,
        [
          appointmentId,
          service_id,
          svc?.[0]?.duration || null,
          svc?.[0]?.price || null,
        ]
      );
    }

    return appointmentId;
  }
  return null;
};

exports.getAppointmentById = async (appointment_id) => {
  const [rows] = await db.query(
    `SELECT * FROM appointments WHERE appointment_id = ?`,
    [appointment_id]
  );
  return rows[0];
};

exports.rescheduleAppointment = async (appointment_id, new_scheduled_time) => {
  await db.query(
    `UPDATE appointments SET scheduled_time = ?, status = 'booked' WHERE appointment_id = ?`,
    [new_scheduled_time, appointment_id]
  );
};

exports.checkRescheduleAvailability = async (staff_id, new_scheduled_time, appointment_id) => {
  const [count] = await db.query(
    `SELECT COUNT(*) AS count FROM appointments 
     WHERE staff_id = ? AND status = 'booked' AND scheduled_time = ? AND appointment_id != ?`,
    [staff_id, new_scheduled_time, appointment_id]
  );
  if (count[0].count === 0) {
    return true;
  }
  return false;
};

exports.cancelAppointment = async (appointment_id) => {
  await db.query(
    `UPDATE appointments SET status = 'cancelled' WHERE appointment_id = ?`,
    [appointment_id]
  );
};

exports.getBarberSchedule = async (staff_id) => {
  const [apps] = await db.query(
    `SELECT 
        a.appointment_id, 
        a.status, 
        a.scheduled_time, 
        GROUP_CONCAT(s.custom_name SEPARATOR ', ') AS service_name, 
        u.full_name AS customer_name
     FROM appointments a
     LEFT JOIN appointment_services aps ON a.appointment_id = aps.appointment_id
     LEFT JOIN services s ON aps.service_id = s.service_id
     LEFT JOIN users u ON a.user_id = u.user_id
     WHERE a.staff_id = ? AND DATE(a.scheduled_time) = CURDATE() AND a.status = 'booked'
     GROUP BY a.appointment_id
     ORDER BY a.scheduled_time`,
    [staff_id]
  );
  return apps;
};

exports.getStaffIdByUserId = async (user_id) => {
  const [rows] = await db.query(
    `SELECT staff_id FROM staff WHERE user_id = ?`,
    [user_id]
  );
  if (rows[0] && rows[0].staff_id) {
    return rows[0].staff_id;
  }
  return null;
};

exports.blockTimeSlot = async (staff_id, start_datetime, end_datetime, reason) => {
  const [result] = await db.query(
    `INSERT INTO staff_time_off (staff_id, start_datetime, end_datetime, reason, status)
     VALUES (?, ?, ?, ?, 'approved')`,
    [staff_id, start_datetime, end_datetime, reason || "Blocked time slot"]
  );
  return result.insertId;
};
