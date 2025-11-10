//salons/controller.js
const salonService = require("./service");
const { db } = require("../../config/database");

exports.createSalon = async (req, res) => {
  try {
    const owner_id = req.user.user_id || req.user.id;
    const { name, address, description } = req.body;

    const salon = await salonService.createSalon({
      ownerId: owner_id,
      name,
      address,
      description,
    });

    res.status(201).json({
      salon_id: salon.salon_id,
      message: "Salon registered",
    });
  } catch (err) {
    console.error("Create salon error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.listPendingSalons = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM salons WHERE status = ?",
      ["pending"]
    );
    res.json(rows);
  } catch (err) {
    console.error("List pending error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateSalonStatus = async (req, res) => {
  try {
    const { salon_id } = req.params;
    const { status, review_status, rejected_reason } = req.body;
    const reviewed_by = req.user.user_id || req.user.id;

    if (status) {
      if (!["pending", "active", "blocked"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Allowed: pending, active, blocked" });
      }
      await db.query("UPDATE salons SET status = ? WHERE salon_id = ?", [
        status,
        salon_id,
      ]);
    }

    if (review_status) {
      if (
        !["pending", "approved", "rejected", "blocked"].includes(review_status)
      ) {
        return res.status(400).json({
          error:
            "Invalid review_status. Allowed: pending, approved, rejected, blocked",
        });
      }
      await db.query(
        `INSERT INTO salon_admin (salon_id, reviewed_by, review_status, rejected_reason, reviewed_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE review_status = VALUES(review_status), rejected_reason = VALUES(rejected_reason), reviewed_at = NOW()`,
        [salon_id, reviewed_by, review_status, rejected_reason || null]
      );
    }

    res.json({
      message: "Salon status updated",
      status,
      review_status,
    });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.listActiveSalons = async (req, res) => {
  try {
    const salons = await salonService.getSalons({
      q: req.query.q,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
    });
    res.json(salons);
  } catch (err) {
    console.error("List salons error:", err);
    res.status(500).json({ error: err.message });
  }
};
