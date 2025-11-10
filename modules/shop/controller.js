//shop/controller.js
const shopService = require("./service");

exports.addProduct = async (req, res) => {
  try {
    const { salon_id, name, category, description, price, stock } = req.body;
    const product_id = await shopService.addProduct(salon_id, name, category, description, price, stock);
    res.json({ message: "Product added", product_id });
  } catch (err) {
    console.error("Add product error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { product_id } = req.params;
    const { name, category, description, price, stock, is_active } = req.body;
    await shopService.updateProduct(product_id, name, category, description, price, stock, is_active);
    res.json({ message: "Product updated" });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getSalonProducts = async (req, res) => {
  try {
    const { salon_id } = req.params;
    const products = await shopService.getSalonProducts(salon_id);
    res.json(products);
  } catch (err) {
    console.error("Get products error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { product_id, quantity, price, salon_id } = req.body;
    const user_id = req.user.user_id || req.user.id;

    const cart_id = await shopService.getOrCreateCart(user_id, salon_id);
    await shopService.addToCart(cart_id, product_id, quantity, price);
    res.json({ message: "Added to cart" });
  } catch (err) {
    console.error("Cart error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const { salon_id } = req.query;
    const user_id = req.user.user_id || req.user.id;

    const cart = await shopService.getCart(user_id, salon_id);
    res.json(cart);
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.checkoutCart = async (req, res) => {
  try {
    const { salon_id, payment_method } = req.body;
    const user_id = req.user.user_id || req.user.id;

    const cart_id = await shopService.getOrCreateCart(user_id, salon_id);
    const total = await shopService.getCartTotal(cart_id);

    if (!total) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const payment_id = await shopService.createPayment(user_id, total, payment_method);
    const order_id = await shopService.createOrder(user_id, salon_id, total, payment_id);
    const cartItems = await shopService.getCartItems(cart_id);
    await shopService.addOrderItems(order_id, cartItems);
    await shopService.closeCart(cart_id);

    res.json({ message: "Order placed", order_id });
  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({ error: err.message });
  }
};

