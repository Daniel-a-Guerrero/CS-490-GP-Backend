// customer/routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('./controller');


// Routes
router.get('/', ctrl.getAllCustomers);
router.get('/:id', ctrl.getCustomer);
router.post('/', ctrl.createCustomer);
router.put('/:id', ctrl.updateCustomer);
router.delete('/:id', ctrl.deleteCustomer);


module.exports = router;


