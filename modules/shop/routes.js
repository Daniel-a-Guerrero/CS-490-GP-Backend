//shop/routes.js
const express = require("express");
const router = express.Router();
const shopController = require("./controller");
const { verifyCustomJwt } = require("../../middleware/verifyCustomJwt");

router.post("/add-product", verifyCustomJwt, shopController.addProduct);
router.put("/update-product/:product_id", verifyCustomJwt, shopController.updateProduct);
router.get("/products/:salon_id", shopController.getSalonProducts);
router.post("/add-to-cart", verifyCustomJwt, shopController.addToCart);
router.get("/cart", verifyCustomJwt, shopController.getCart);
router.post("/checkout", verifyCustomJwt, shopController.checkoutCart);

module.exports = router;

