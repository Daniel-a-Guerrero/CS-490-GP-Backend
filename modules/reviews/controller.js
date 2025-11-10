//reviews/controller.js
const reviewService = require("./service");

exports.addReview = async (req, res) => {
  try {
    const { appointment_id, salon_id, staff_id, rating, comment } = req.body;
    const user_id = req.user.user_id || req.user.id;

    if (!user_id) {
      return res.status(400).json({ error: "User not authenticated" });
    }

    const review_id = await reviewService.addReview(appointment_id, user_id, salon_id, staff_id, rating, comment);
    res.json({ message: "Review added", review_id });
  } catch (err) {
    console.error("Add review error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.addReviewResponse = async (req, res) => {
  try {
    const review_id = req.params.id;
    const { response } = req.body;
    await reviewService.addReviewResponse(review_id, response);
    res.json({ message: "Response added" });
  } catch (err) {
    console.error("Response error:", err);
    res.status(500).json({ error: err.message });
  }
};

