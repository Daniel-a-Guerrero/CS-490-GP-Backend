//history/controller.js
const historyService = require("./service");

exports.getUserHistory = async (req, res) => {
  try {
    const user_id = req.user.user_id || req.user.id;
    const appointments = await historyService.getUserHistory(user_id);
    res.json(appointments);
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSalonVisitHistory = async (req, res) => {
  try {
    const salon_id = req.params.salon_id;
    const visits = await historyService.getSalonVisitHistory(salon_id);
    res.json({ visits });
  } catch (err) {
    console.error("Visit history error:", err);
    res.status(500).json({ error: err.message });
  }
};

