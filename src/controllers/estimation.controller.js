const Estimation = require('../models/Estimation')
const GoldRate   = require('../models/GoldRate')
const { calculateItemPrice } = require('../utils/priceCalculator')
const { sendResponse, sendError } = require('../utils/response')

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RATE_MAP = (gr) => ({
  '18K': gr.rate18K,
  '14K': gr.rate14K,
  '22K': gr.rate22K,
  '24K': gr.rate24K,
})

// ─── Create estimation ────────────────────────────────────────────────────────
// @route POST /api/v1/estimations
const createEstimation = async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      items,
      validDays = 3,
      notes,
    } = req.body

    if (!items || items.length === 0) {
      return sendError(res, 400, 'At least one item is required')
    }

    // Fetch today's gold rate (falls back to most recent)
    const goldRate = await GoldRate.getTodayRateWithFallback()
    if (!goldRate) {
      return sendError(res, 400, "No gold rate found. Please set today's gold rate first.")
    }

    const rates = RATE_MAP(goldRate)
    let subTotal = 0
    const estimationItems = []

    for (const item of items) {
      const rate = rates[item.purity]
      if (!rate) {
        return sendError(res, 400, `No gold rate available for purity ${item.purity}`)
      }

      // Price without GST (GST applied at estimation level)
      const price = calculateItemPrice({
        netWeight:         item.netWeight,
        goldRatePerGram:   rate,
        makingCharge:      item.makingCharge       || 0,
        makingChargeFixed: item.makingChargeFixed  || 0,
        stoneCharge:       item.stoneCharge        || 0,
        gstRate: 0,
      })

      const itemGst   = parseFloat(((price.subTotal * 3) / 100).toFixed(2))
      const itemTotal = parseFloat((price.subTotal + itemGst).toFixed(2))

      estimationItems.push({
        name:              (item.name || item.category || 'Jewellery Item').trim(),
        category:          item.category || '',
        purity:            item.purity,
        grossWeight:       Number(item.grossWeight)       || 0,
        netWeight:         Number(item.netWeight),
        stoneWeight:       Number(item.stoneWeight)       || 0,
        goldRateUsed:      rate,
        goldValue:         price.goldValue,
        makingCharge:      Number(item.makingCharge)      || 0,
        makingChargeFixed: Number(item.makingChargeFixed) || 0,
        makingValue:       price.makingValue,
        stoneCharge:       price.stoneCharge,
        subTotal:          price.subTotal,
        gstAmount:         itemGst,
        totalAmount:       itemTotal,
      })

      subTotal += price.subTotal
    }

    const gstRate   = 3
    const gstAmount = parseFloat(((subTotal * gstRate) / 100).toFixed(2))
    const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))

    // Compute validity date
    const days      = Math.max(1, Math.min(30, Number(validDays)))
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + days)

    const estimation = await Estimation.create({
      customerName:  customerName?.trim()  || 'Walk-in Customer',
      customerPhone: customerPhone?.trim() || undefined,
      items: estimationItems,
      goldRateDate:  goldRate.date,
      subTotal,
      gstRate,
      gstAmount,
      totalAmount,
      validDays: days,
      validUntil,
      notes,
      createdBy: req.user._id,
    })

    sendResponse(res, 201, estimation, 'Estimation created successfully')
  } catch (err) {
    next(err)
  }
}

// ─── List estimations ─────────────────────────────────────────────────────────
// @route GET /api/v1/estimations
const getEstimations = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query
    const filter = {}
    if (status) filter.status = status

    const total = await Estimation.countDocuments(filter)
    const estimations = await Estimation.find(filter)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .select('-items') // exclude item details in list view for performance

    sendResponse(res, 200, { total, page: Number(page), estimations })
  } catch (err) {
    next(err)
  }
}

// ─── Get single estimation ────────────────────────────────────────────────────
// @route GET /api/v1/estimations/:id
const getEstimation = async (req, res, next) => {
  try {
    const estimation = await Estimation.findById(req.params.id)
      .populate('createdBy', 'name')
    if (!estimation) return sendError(res, 404, 'Estimation not found')
    sendResponse(res, 200, estimation)
  } catch (err) {
    next(err)
  }
}

// ─── Update status ────────────────────────────────────────────────────────────
// @route PATCH /api/v1/estimations/:id/status
const updateEstimationStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    const allowed = ['active', 'expired', 'converted']
    if (!allowed.includes(status)) {
      return sendError(res, 400, `Status must be one of: ${allowed.join(', ')}`)
    }
    const estimation = await Estimation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
    if (!estimation) return sendError(res, 404, 'Estimation not found')
    sendResponse(res, 200, estimation, 'Status updated successfully')
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createEstimation,
  getEstimations,
  getEstimation,
  updateEstimationStatus,
}
