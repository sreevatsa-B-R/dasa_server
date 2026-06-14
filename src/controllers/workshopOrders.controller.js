const PurchaseOrder = require('../models/PurchaseOrder')
const Artisan = require('../models/Artisan')
const Item = require('../models/Item')
const { PURCHASE_ORDER_STATUS, ITEM_STATUS } = require('../config/constants')
const { calculateWastage } = require('../utils/priceCalculator')
const { sendResponse, sendError } = require('../utils/response')

// @desc  Create workshop order (send work to artisan)
// @route POST /api/v1/orders/workshop
const createWorkshopOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.create({
      ...req.body,
      orderType: 'workshop',
      status: PURCHASE_ORDER_STATUS.RAISED,
      createdBy: req.user._id,
    })
    sendResponse(res, 201, order, 'Workshop order created')
  } catch (err) {
    next(err)
  }
}

// @desc  Get all workshop orders
// @route GET /api/v1/orders/workshop
const getWorkshopOrders = async (req, res, next) => {
  try {
    const { artisanId, status, page = 1, limit = 20 } = req.query
    const filter = { orderType: 'workshop' }

    if (artisanId) filter.artisan = artisanId
    if (status)    filter.status = status

    const total = await PurchaseOrder.countDocuments(filter)
    const orders = await PurchaseOrder.find(filter)
      .populate('artisan', 'name phone')
      .populate('customerOrderRef', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    sendResponse(res, 200, { total, page: Number(page), orders })
  } catch (err) {
    next(err)
  }
}

// @desc  Get single workshop order
// @route GET /api/v1/orders/workshop/:id
const getWorkshopOrderById = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('artisan', 'name phone allowedWastagePct')
      .populate('customerOrderRef')
    if (!order || order.orderType !== 'workshop') return sendError(res, 404, 'Workshop order not found')
    sendResponse(res, 200, order)
  } catch (err) {
    next(err)
  }
}

// @desc  Update workshop order
// @route PUT /api/v1/orders/workshop/:id
const updateWorkshopOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!order) return sendError(res, 404, 'Workshop order not found')
    sendResponse(res, 200, order, 'Workshop order updated')
  } catch (err) {
    next(err)
  }
}

// @desc  Issue gold to artisan
// @route POST /api/v1/orders/workshop/:id/issue-gold
const issueGold = async (req, res, next) => {
  try {
    const { goldIssuedWeight } = req.body
    const order = await PurchaseOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Workshop order not found')

    order.goldIssuedWeight = goldIssuedWeight
    order.goldIssuedDate = new Date()
    order.status = PURCHASE_ORDER_STATUS.GOLD_ISSUED

    await order.save()

    // Update artisan tracking
    if (order.artisan) {
      await Artisan.findByIdAndUpdate(order.artisan, {
        $inc: { totalGoldIssued: goldIssuedWeight, currentGoldWithArtisan: goldIssuedWeight }
      })
    }

    sendResponse(res, 200, order, `Gold issued: ${goldIssuedWeight}g`)
  } catch (err) {
    next(err)
  }
}

// @desc  Receive finished item from artisan, add to stock
// @route POST /api/v1/orders/workshop/:id/receive
const receiveWorkshopOrder = async (req, res, next) => {
  try {
    const { receivedWeight, itemDetails, purityCertRef } = req.body
    const order = await PurchaseOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Workshop order not found')

    const { wastageWeight, wastagePct } = calculateWastage(order.goldIssuedWeight, receivedWeight)

    order.receivedWeight = receivedWeight
    order.receivedDate = new Date()
    order.wastageWeight = wastageWeight
    order.wastagePct = wastagePct
    order.purityCertRef = purityCertRef
    order.status = PURCHASE_ORDER_STATUS.RECEIVED

    await order.save()

    // Update artisan gold tracking
    if (order.artisan) {
      await Artisan.findByIdAndUpdate(order.artisan, {
        $inc: { totalGoldReturned: receivedWeight, currentGoldWithArtisan: -order.goldIssuedWeight }
      })
    }

    // Add finished item to inventory if item details provided
    let newItem = null
    if (itemDetails) {
      newItem = await Item.create({
        ...itemDetails,
        status: ITEM_STATUS.IN_STOCK,
        purchaseOrderRef: order._id,
        addedBy: req.user._id,
      })
    }

    sendResponse(res, 200, { order, newItem }, 'Workshop order received and stock updated')
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createWorkshopOrder, getWorkshopOrders, getWorkshopOrderById,
  updateWorkshopOrder, issueGold, receiveWorkshopOrder,
}
