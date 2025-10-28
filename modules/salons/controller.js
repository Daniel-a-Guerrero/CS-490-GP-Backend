const { query } = require('../../config/database');

//As a user, I want to browse available salons so that I can choose where to book 
exports.getAllSalons = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    //free days sent by the user to filter salons
    const { freeDays } = req.query // e.g., ?freeDays=Monday,Tuesday
    const daysArray = freeDays ? freeDays.split(',') : [];
    try {
        const salons = await query(
            "select s.salon_id, sa.* from salon_platform.staff_availability sa join salon_platform.staff s  where sa.day_of_week IN ? and s.staff_id = sa.staff_id", [daysArray]);
        res.json(salons);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch salons' });
    }
};

exports.getStaffBySalonId = async (req, res) => {
    const salonId=req.params.salonId;
    try{
        const staff=await query('SELECT * FROM salon_platform.staff WHERE salon_id=?',[salonId]);
        res.json(staff);
    }
    catch(error){
        res.status(500).json({error:'Failed to fetch staff for the salon'});
    }
};

//B4: As a barber, I want to view my daily schedule so that I can prepare in advance.
exports.getDailySchedule = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const staffId = req.user.uid; // Assuming the Firebase UID matches the staff ID
    const { date } = req.query; // e.g., ?date=2023-10-15
    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
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
        res.status(500).json({ error: 'Failed to fetch daily schedule' });
    }
};

//U1: As a user, I want to view my visit history so that I can track past services
exports.getUserVisitHistory = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.user.uid; // Assuming the Firebase UID matches the customer ID
    try {
        const history = await query(
            `select h.*
            from salon_platform.history h
            where h.user_id=?`, [userId]);
            res.json(history);
        } catch (error) {
        res.status(500).json({ error: 'Failed to fetch visit history' });
    }
};
//U2: As a salon owner, I want to see customer visit histories so that I can provide personalized service
exports.getCustomerVisitHistory = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { customerId } = req.params;
    try {
        const history = await query(`select h.*
        from salon_platform.history h
        where h.user_id=?`, [customerId]);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customer visit history' });
    }
};

