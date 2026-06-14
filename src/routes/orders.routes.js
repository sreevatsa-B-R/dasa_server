const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager, notViewer } = require('../middleware/role')
const {
  createCustomerOrder, getCustomerOrders, getCustomerOrderById,
  updateCustomerOrder, sendToArtisan, receiveFromArtisan,
  deliverOrder, getOverdueOrders, getReadyOrders,
} = require('../controllers/orders.controller')
const {
  createWorkshopOrder, getWorkshopOrders, getWorkshopOrderById,
  updateWorkshopOrder, issueGold, receiveWorkshopOrder,
} = require('../controllers/workshopOrders.controller')

// ── Customer Orders ────────────────────────────────────────
router.route('/customer')
  .post(protect, notViewer, createCustomerOrder)
  .get(protect, getCustomerOrders)

router.get('/customer/overdue', protect, isAdminOrManager, getOverdueOrders)
router.get('/customer/ready',   protect, getReadyOrders)

router.route('/customer/:id')
  .get(protect, getCustomerOrderById)
  .put(protect, isAdminOrManager, updateCustomerOrder)

router.post('/customer/:id/send-to-artisan', protect, isAdminOrManager, sendToArtisan)
router.post('/customer/:id/receive',         protect, isAdminOrManager, receiveFromArtisan)
router.post('/customer/:id/deliver',         protect, notViewer, deliverOrder)

// ── Workshop Orders ────────────────────────────────────────
router.route('/workshop')
  .post(protect, isAdminOrManager, createWorkshopOrder)
  .get(protect, isAdminOrManager, getWorkshopOrders)

router.route('/workshop/:id')
  .get(protect, isAdminOrManager, getWorkshopOrderById)
  .put(protect, isAdminOrManager, updateWorkshopOrder)

router.post('/workshop/:id/issue-gold', protect, isAdminOrManager, issueGold)
router.post('/workshop/:id/receive',    protect, isAdminOrManager, receiveWorkshopOrder)

module.exports = router
