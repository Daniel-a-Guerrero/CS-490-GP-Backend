//reviews/routes.js
const express = require("express");
const router = express.Router();
const reviewController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/add", verifyCustomJwt, reviewController.addReview);
router.put("/respond/:id", verifyCustomJwt, reviewController.addReviewResponse);

module.exports = router;

