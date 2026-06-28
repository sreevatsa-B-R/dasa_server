const CustomerOrder = require('../models/CustomerOrder')
const Artisan = require('../models/Artisan')
const SalesInvoice = require('../models/SalesInvoice')
const { ORDER_STATUS } = require('../config/constants')
const { calculateWastage } = require('../utils/priceCalculator')
const { sendResponse, sendError } = require('../utils/response')

const addStatusHistory = (order, status, userId, note = '') => {
  order.status = status
  order.statusHistory.push({ status, changedBy: userId, note })
}

// @desc  Create customer order
// @route POST /api/v1/orders/customer
const createCustomerOrder = async (req, res, next) => {
  try {
    const {
      customerId, itemDescription, category, purity,
      estimatedWeight, agreedGoldRate, makingCharge, stoneCharge,
      estimatedAmount, designNotes, expectedDelivery, advancePayment,
    } = req.body

    const order = new CustomerOrder({
      customer: customerId,
      itemDescription, category, purity,
      estimatedWeight, agreedGoldRate, makingCharge, stoneCharge,
      estimatedAmount, designNotes,
      expectedDelivery: new Date(expectedDelivery),
      createdBy: req.user._id,
    })

    addStatusHistory(order, ORDER_STATUS.NEW, req.user._id, 'Order created')

    // Record initial advance if provided
    if (advancePayment && advancePayment.amount > 0) {
      order.advancePayments.push({ ...advancePayment, receivedBy: req.user._id })
      order.totalAdvancePaid = advancePayment.amount
      order.balanceDue = (estimatedAmount || 0) - advancePayment.amount
    }

    await order.save()
    sendResponse(res, 201, order, 'Customer order created')
  } catch (err) {
    next(err)
  }
}

// @desc  Get all customer orders
// @route GET /api/v1/orders/customer?status=&customerId=&from=&to=
const getCustomerOrders = async (req, res, next) => {
  try {
    const { status, customerId, from, to, page = 1, limit = 20 } = req.query
    const filter = {}

    if (status)     filter.status = status
    if (customerId) filter.customer = customerId
    if (from || to) {
      filter.orderDate = {}
      if (from) filter.orderDate.$gte = new Date(from)
      if (to)   filter.orderDate.$lte = new Date(to)
    }

    const total = await CustomerOrder.countDocuments(filter)
    const orders = await CustomerOrder.find(filter)
      .populate('customer', 'name phone')
      .populate('assignedArtisan', 'name phone')
      .populate('inventoryItemRef')
      .sort({ expectedDelivery: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    sendResponse(res, 200, { total, page: Number(page), orders })
  } catch (err) {
    next(err)
  }
}

// @desc  Get single customer order
// @route GET /api/v1/orders/customer/:id
const getCustomerOrderById = async (req, res, next) => {
  try {
    const order = await CustomerOrder.findById(req.params.id)
      .populate('customer', 'name phone address panNumber aadharNumber')
      .populate('assignedArtisan', 'name phone')
      .populate('createdBy', 'name')
      .populate('inventoryItemRef')
    if (!order) return sendError(res, 404, 'Order not found')
    sendResponse(res, 200, order)
  } catch (err) {
    next(err)
  }
}

// @desc  Update customer order
// @route PUT /api/v1/orders/customer/:id
const updateCustomerOrder = async (req, res, next) => {
  try {
    const oldOrder = await CustomerOrder.findById(req.params.id)
    if (!oldOrder) return sendError(res, 404, 'Order not found')

    const order = await CustomerOrder.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!order) return sendError(res, 404, 'Order not found')

    if (order.status === ORDER_STATUS.READY && (!oldOrder.inventoryItemRef && !order.inventoryItemRef)) {
      const Item = require('../models/Item')
      
      const payload = {
        name: order.itemDescription,
        category: order.category || 'Other',
        metal: order.metal || 'gold',
        purity: order.purity || '22K',
        grossWeight: order.actualWeight || order.estimatedWeight || 0,
        netWeight: order.actualWeight || order.estimatedWeight || 0,
        stoneWeight: 0,
        makingCharge: order.makingCharge || 0,
        makingChargeFixed: 0,
        stoneCharge: order.stoneCharge || 0,
        wastage: order.wastageWeight || 0,
        description: `Created from Order ${order.orderNumber}`,
        addedBy: req.user._id,
        customerOrderRef: order._id,
      }
      
      const item = await Item.create(payload)
      order.inventoryItemRef = item._id
      await order.save()
    }

    if (order.inventoryItemRef) {
      await order.populate('inventoryItemRef')
    }

    sendResponse(res, 200, order, 'Order updated')
  } catch (err) {
    next(err)
  }
}

// @desc  Send order to artisan
// @route POST /api/v1/orders/customer/:id/send-to-artisan
const sendToArtisan = async (req, res, next) => {
  try {
    const { artisanId, goldIssuedWeight } = req.body
    const order = await CustomerOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Order not found')

    const artisan = await Artisan.findById(artisanId)
    if (!artisan) return sendError(res, 404, 'Artisan not found')

    order.assignedArtisan = artisanId
    order.goldIssuedToArtisan = goldIssuedWeight
    order.goldIssuedDate = new Date()
    addStatusHistory(order, ORDER_STATUS.SENT_TO_ARTISAN, req.user._id, `Gold issued: ${goldIssuedWeight}g to ${artisan.name}`)

    await order.save()

    // Update artisan's gold tracking
    await Artisan.findByIdAndUpdate(artisanId, {
      $inc: { totalGoldIssued: goldIssuedWeight, currentGoldWithArtisan: goldIssuedWeight }
    })

    sendResponse(res, 200, order, 'Order sent to artisan')
  } catch (err) {
    next(err)
  }
}

// @desc  Receive completed item from artisan
// @route POST /api/v1/orders/customer/:id/receive
const receiveFromArtisan = async (req, res, next) => {
  try {
    const { actualWeight, qualityPassed, note } = req.body
    const order = await CustomerOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Order not found')

    const { wastageWeight, wastagePct } = calculateWastage(order.goldIssuedToArtisan, actualWeight)
    order.actualWeight = actualWeight
    order.wastageWeight = wastageWeight

    const newStatus = qualityPassed ? ORDER_STATUS.QUALITY_CHECK : ORDER_STATUS.REWORK
    addStatusHistory(order, newStatus, req.user._id,
      `Received: ${actualWeight}g. Wastage: ${wastageWeight}g (${wastagePct}%). ${note || ''}`)

    await order.save()

    // Update artisan gold tracking
    if (order.assignedArtisan) {
      await Artisan.findByIdAndUpdate(order.assignedArtisan, {
        $inc: { totalGoldReturned: actualWeight, currentGoldWithArtisan: -order.goldIssuedToArtisan }
      })
    }

    sendResponse(res, 200, order, qualityPassed ? 'Item received — quality check passed' : 'Item received — sent for rework')
  } catch (err) {
    next(err)
  }
}

// @desc  Deliver order to customer and convert to invoice
// @route POST /api/v1/orders/customer/:id/deliver
const deliverOrder = async (req, res, next) => {
  try {
    const { finalAmount, balancePayment } = req.body
    const order = await CustomerOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Order not found')

    if (order.status !== ORDER_STATUS.READY) {
      return sendError(res, 400, 'Order is not ready for delivery')
    }

    order.finalAmount = finalAmount
    order.actualDelivery = new Date()
    addStatusHistory(order, ORDER_STATUS.DELIVERED, req.user._id, 'Delivered to customer')

    if (balancePayment) {
      order.advancePayments.push({ ...balancePayment, receivedBy: req.user._id })
      order.totalAdvancePaid += balancePayment.amount
    }
    order.balanceDue = 0

    await order.save()
    sendResponse(res, 200, order, 'Order delivered successfully')
  } catch (err) {
    next(err)
  }
}

// @desc  Get overdue orders
// @route GET /api/v1/orders/customer/overdue
const getOverdueOrders = async (req, res, next) => {
  try {
    const orders = await CustomerOrder.find({
      expectedDelivery: { $lt: new Date() },
      status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] },
    })
      .populate('customer', 'name phone')
      .populate('assignedArtisan', 'name phone')
      .sort({ expectedDelivery: 1 })

    sendResponse(res, 200, orders)
  } catch (err) {
    next(err)
  }
}

// @desc  Get orders ready for delivery
// @route GET /api/v1/orders/customer/ready
const getReadyOrders = async (req, res, next) => {
  try {
    const orders = await CustomerOrder.find({ status: ORDER_STATUS.READY })
      .populate('customer', 'name phone')
      .populate('inventoryItemRef')
      .sort({ expectedDelivery: 1 })

    sendResponse(res, 200, orders)
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createCustomerOrder, getCustomerOrders, getCustomerOrderById,
  updateCustomerOrder, sendToArtisan, receiveFromArtisan,
  deliverOrder, getOverdueOrders, getReadyOrders,
}
