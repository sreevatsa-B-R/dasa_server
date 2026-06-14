const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager, notViewer } = require('../middleware/role')
const {
  createInvoice, getInvoices, getInvoiceById,
  processReturn, getReceipt, getInvoicePdf, evaluateOldGold, priceEstimate,
} = require('../controllers/sales.controller')

router.route('/invoices')
  .post(protect, notViewer, createInvoice)
  .get(protect, isAdminOrManager, getInvoices)

router.get('/invoices/:id',         protect, getInvoiceById)
router.post('/invoices/:id/return', protect, isAdminOrManager, processReturn)
router.get('/invoices/:id/receipt', protect, getReceipt)
router.get('/invoices/:id/pdf', protect, getInvoicePdf)
router.post('/old-gold',            protect, notViewer, evaluateOldGold)
router.post('/price-estimate',      protect, priceEstimate)

module.exports = router
