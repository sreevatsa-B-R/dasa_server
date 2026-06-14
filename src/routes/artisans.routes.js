const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager } = require('../middleware/role')
const Artisan = require('../models/Artisan')
const PurchaseOrder = require('../models/PurchaseOrder')
const { sendResponse, sendError } = require('../utils/response')

// POST /api/v1/artisans
router.post('/', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const artisan = await Artisan.create({ ...req.body, addedBy: req.user._id })
    sendResponse(res, 201, artisan, 'Artisan registered')
  } catch (err) { next(err) }
})

// GET /api/v1/artisans
router.get('/', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const artisans = await Artisan.find({ isActive: true }).sort({ name: 1 })
    sendResponse(res, 200, artisans)
  } catch (err) { next(err) }
})

// GET /api/v1/artisans/:id
router.get('/:id', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const artisan = await Artisan.findById(req.params.id)
    if (!artisan) return sendError(res, 404, 'Artisan not found')

    // Get their order history
    const orders = await PurchaseOrder.find({ artisan: req.params.id, orderType: 'workshop' })
      .sort({ createdAt: -1 }).limit(20)

    // Wastage summary
    const wastageSummary = {
      totalGoldIssued: artisan.totalGoldIssued,
      totalGoldReturned: artisan.totalGoldReturned,
      totalWastage: parseFloat((artisan.totalGoldIssued - artisan.totalGoldReturned).toFixed(3)),
      wastagePct: artisan.totalGoldIssued > 0
        ? parseFloat((((artisan.totalGoldIssued - artisan.totalGoldReturned) / artisan.totalGoldIssued) * 100).toFixed(2))
        : 0,
      currentGoldWithArtisan: artisan.currentGoldWithArtisan,
    }

    sendResponse(res, 200, { artisan, orders, wastageSummary })
  } catch (err) { next(err) }
})

// PUT /api/v1/artisans/:id
router.put('/:id', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const artisan = await Artisan.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!artisan) return sendError(res, 404, 'Artisan not found')
    sendResponse(res, 200, artisan, 'Artisan updated')
  } catch (err) { next(err) }
})

module.exports = router
