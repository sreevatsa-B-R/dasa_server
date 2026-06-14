const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager, isAdminOrAccountant, notViewer } = require('../middleware/role')
const Customer = require('../models/Customer')
const SalesInvoice = require('../models/SalesInvoice')
const CustomerOrder = require('../models/CustomerOrder')
const { sendResponse, sendError } = require('../utils/response')

// POST /api/v1/customers
router.post('/', protect, notViewer, async (req, res, next) => {
  try {
    const customer = await Customer.create({ ...req.body, addedBy: req.user._id })
    sendResponse(res, 201, customer, 'Customer registered')
  } catch (err) { next(err) }
})

// GET /api/v1/customers?search=
router.get('/', protect, async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query
    const filter = { isActive: true }
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ]
    const total = await Customer.countDocuments(filter)
    const customers = await Customer.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    sendResponse(res, 200, { total, customers })
  } catch (err) { next(err) }
})

// GET /api/v1/customers/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id)
    if (!customer) return sendError(res, 404, 'Customer not found')
    sendResponse(res, 200, customer)
  } catch (err) { next(err) }
})

// PUT /api/v1/customers/:id
router.put('/:id', protect, notViewer, async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!customer) return sendError(res, 404, 'Customer not found')
    sendResponse(res, 200, customer, 'Customer updated')
  } catch (err) { next(err) }
})

// GET /api/v1/customers/:id/history
router.get('/:id/history', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const [invoices, orders] = await Promise.all([
      SalesInvoice.find({ customer: req.params.id, isReturn: false }).sort({ invoiceDate: -1 }).limit(20),
      CustomerOrder.find({ customer: req.params.id }).sort({ orderDate: -1 }).limit(20),
    ])
    sendResponse(res, 200, { invoices, orders })
  } catch (err) { next(err) }
})

// GET /api/v1/customers/:id/outstanding
router.get('/:id/outstanding', protect, isAdminOrAccountant, async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).select('name phone outstandingBalance')
    if (!customer) return sendError(res, 404, 'Customer not found')

    const pendingOrders = await CustomerOrder.find({
      customer: req.params.id,
      balanceDue: { $gt: 0 },
    }).select('orderNumber estimatedAmount totalAdvancePaid balanceDue expectedDelivery')

    sendResponse(res, 200, { customer, pendingOrders })
  } catch (err) { next(err) }
})

module.exports = router
