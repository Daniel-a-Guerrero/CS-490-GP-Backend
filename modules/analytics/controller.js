// modules/analytics/controller.js
const analyticsService = require("./service");

exports.getOverview = async (req, res) => {
  try {
    const salonId = Number(req.query.salonId);
    if (!salonId) {
      return res.status(400).json({ message: "salonId is required as a query param" });
    }
    const { start, end, range } = req.query;
    const data = await analyticsService.getOverview({ salonId, start, end, range });
    res.json({ ok: true, data });
  } catch (err) {
    console.error("analytics.getOverview error:", err);
    res.status(500).json({ ok: false, message: "Failed to compute analytics" });
  }
};

exports.getRevenueSeries = async (req, res) => {
  try {
    const salonId = Number(req.query.salonId);
    const days = req.query.days ? Number(req.query.days) : 7;
    if (!salonId) return res.status(400).json({ ok: false, message: "salonId is required" });

    const data = await analyticsService.getRevenueSeries({ salonId, days });
    res.json({ ok: true, data });
  } catch (e) {
    console.error("analytics.getRevenueSeries error:", e);
    res.status(500).json({ ok: false, message: "Failed to compute revenue series" });
  }
};

exports.getServiceDistribution = async (req, res) => {
  try {
    const salonId = Number(req.query.salonId);
    const { start, end } = req.query;
    if (!salonId) return res.status(400).json({ ok: false, message: "salonId is required" });

    const data = await analyticsService.getServiceDistribution({ salonId, start, end });
    res.json({ ok: true, data });
  } catch (e) {
    console.error("analytics.getServiceDistribution error:", e);
    res.status(500).json({ ok: false, message: "Failed to compute service distribution" });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const salonId = Number(req.query.salonId);
    if (!salonId) {
      return res.status(400).json({ ok: false, message: "salonId is required" });
    }
    const data = await analyticsService.getDashboardAnalytics({ salonId });
    res.json({ ok: true, data });
  } catch (err) {
    console.error("analytics.getDashboard error:", err);
    res
      .status(500)
      .json({
        ok: false,
        message: err?.message || "Failed to load analytics dashboard",
        details: err?.sqlMessage || err?.stack,
      });
  }
};
