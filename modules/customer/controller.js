// customer/controller.js
const Customer = require('./model');


// GET /api/customers
exports.getAllCustomers = async (req, res, next) => {
  try {
    const { salon_id, q } = req.query;
    const data = await Customer.getAll({ salon_id, q });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};


// GET /api/customers/:id
exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.getById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) {
    next(err);
  }
};


// POST /api/customers
exports.createCustomer = async (req, res, next) => {
  try {
    const { full_name, email, phone } = req.body;
    if (!full_name || !email || !phone)
      return res.status(400).json({ success: false, message: 'Missing required fields' });


    const result = await Customer.create({ full_name, email, phone });
    res.status(201).json({ success: true, id: result.id });
  } catch (err) {
    next(err);
  }
};


// PUT /api/customers/:id
exports.updateCustomer = async (req, res, next) => {
  try {
    const updated = await Customer.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer updated' });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/customers/:id
exports.deleteCustomer = async (req, res, next) => {
  try {
    const deleted = await Customer.remove(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
};
