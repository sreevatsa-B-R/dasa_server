// ── purchase.routes.js ────────────────────────────────────
const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager, isAdminOrAccountant, notViewer } = require('../middleware/role')
const {
  createSupplier, getSuppliers, getSupplierById, updateSupplier,
  createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById, updatePurchaseOrder,
  receiveGoods, createPurchaseInvoice, recordPayment, getSupplierPayments,
} = require('../controllers/purchase.controller')

router.route('/suppliers')
  .post(protect, isAdminOrManager, createSupplier)
  .get(protect, isAdminOrManager, getSuppliers)

router.route('/suppliers/:id')
  .get(protect, isAdminOrManager, getSupplierById)
  .put(protect, isAdminOrManager, updateSupplier)

router.route('/orders')
  .post(protect, isAdminOrManager, createPurchaseOrder)
  .get(protect, isAdminOrManager, getPurchaseOrders)

router.route('/orders/:id')
  .get(protect, isAdminOrManager, getPurchaseOrderById)
  .put(protect, isAdminOrManager, updatePurchaseOrder)

router.post('/orders/:id/receive',  protect, isAdminOrManager, receiveGoods)
router.post('/orders/:id/invoice',  protect, isAdminOrManager, createPurchaseInvoice)
router.post('/payments',            protect, isAdminOrAccountant, recordPayment)
router.get('/payments/:supplierId', protect, isAdminOrAccountant, getSupplierPayments)

module.exports = router
