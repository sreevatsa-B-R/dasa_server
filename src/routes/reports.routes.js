const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager, isAdminOrAccountant } = require('../middleware/role')
const SalesInvoice = require('../models/SalesInvoice')
const Item = require('../models/Item')
const CustomerOrder = require('../models/CustomerOrder')
const PurchaseOrder = require('../models/PurchaseOrder')
const GoldRate = require('../models/GoldRate')
const JournalEntry = require('../models/JournalEntry')
const { ITEM_STATUS, ORDER_STATUS, PURCHASE_ORDER_STATUS } = require('../config/constants')
const { sendResponse } = require('../utils/response')

const todayStr = () => new Date().toISOString().split('T')[0]
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
const endOfToday   = () => { const d = new Date(); d.setHours(23,59,59,999); return d }

// GET /api/v1/reports/dashboard
router.get('/dashboard', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const [
      todaySales,
      goldRate,
      pendingOrders,
      overdueOrders,
      readyOrders,
      inStockCount,
    ] = await Promise.all([
      SalesInvoice.aggregate([
        { $match: { invoiceDate: { $gte: startOfToday(), $lte: endOfToday() }, isReturn: false } },
        { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      GoldRate.getTodayRateWithFallback(),
      CustomerOrder.countDocuments({ status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] } }),
      CustomerOrder.countDocuments({
        expectedDelivery: { $lt: new Date() },
        status: { $nin: [ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED] },
      }),
      CustomerOrder.countDocuments({ status: ORDER_STATUS.READY }),
      Item.countDocuments({ status: ITEM_STATUS.IN_STOCK, isDeleted: false }),
    ])

    sendResponse(res, 200, {
      today: {
        salesAmount: todaySales[0]?.totalAmount || 0,
        salesCount:  todaySales[0]?.count || 0,
        date: todayStr(),
      },
      goldRate: goldRate || null,
      orders: { pending: pendingOrders, overdue: overdueOrders, ready: readyOrders },
      inventory: { inStock: inStockCount },
    })
  } catch (err) { next(err) }
})

// GET /api/v1/reports/sales?from=&to=&category=
router.get('/sales', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const match = { isReturn: false }
    if (from || to) {
      match.invoiceDate = {}
      if (from) match.invoiceDate.$gte = new Date(from)
      if (to)   match.invoiceDate.$lte = new Date(to)
    }

    const [summary, dailyBreakdown] = await Promise.all([
      SalesInvoice.aggregate([
        { $match: match },
        { $group: {
          _id: null,
          totalRevenue:  { $sum: '$totalAmount' },
          totalGst:      { $sum: '$gstAmount' },
          totalDiscount: { $sum: '$discount' },
          invoiceCount:  { $sum: 1 },
        }}
      ]),
      SalesInvoice.aggregate([
        { $match: match },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } },
          dailyRevenue: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } }
      ]),
    ])

    sendResponse(res, 200, { summary: summary[0] || {}, dailyBreakdown })
  } catch (err) { next(err) }
})

// GET /api/v1/reports/stock-valuation
router.get('/stock-valuation', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const goldRate = await GoldRate.getTodayRateWithFallback()
    const items = await Item.find({ status: ITEM_STATUS.IN_STOCK, isDeleted: false })

    let totalValue = 0
    const valued = items.map(item => {
      const rate = goldRate ? goldRate.getRateForKarat(item.purity) : 0
      const itemValue = item.netWeight * (rate || 0)
      totalValue += itemValue
      return { ...item.toObject(), goldRateUsed: rate, stockValue: parseFloat(itemValue.toFixed(2)) }
    })

    sendResponse(res, 200, {
      goldRateDate: todayStr(),
      totalItems: items.length,
      totalStockValue: parseFloat(totalValue.toFixed(2)),
      items: valued,
    })
  } catch (err) { next(err) }
})

// GET /api/v1/reports/orders-summary
router.get('/orders-summary', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const summary = await CustomerOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    sendResponse(res, 200, summary)
  } catch (err) { next(err) }
})

// GET /api/v1/reports/wastage
router.get('/wastage', protect, isAdminOrManager, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const match = { orderType: 'workshop', wastageWeight: { $exists: true } }
    if (from || to) {
      match.createdAt = {}
      if (from) match.createdAt.$gte = new Date(from)
      if (to)   match.createdAt.$lte = new Date(to)
    }

    const wastage = await PurchaseOrder.aggregate([
      { $match: match },
      { $group: {
        _id: '$artisan',
        totalIssued:   { $sum: '$goldIssuedWeight' },
        totalReturned: { $sum: '$receivedWeight' },
        totalWastage:  { $sum: '$wastageWeight' },
        orderCount:    { $sum: 1 },
      }},
      { $lookup: { from: 'artisans', localField: '_id', foreignField: '_id', as: 'artisanInfo' } },
      { $unwind: { path: '$artisanInfo', preserveNullAndEmpty: true } },
    ])

    sendResponse(res, 200, wastage)
  } catch (err) { next(err) }
})

// GET /api/v1/reports/profit-loss?from=&to=
router.get('/profit-loss', protect, isAdminOrAccountant, async (req, res, next) => {
  try {
    const { from, to } = req.query
    const dateFilter = {}
    if (from) dateFilter.$gte = new Date(from)
    if (to)   dateFilter.$lte = new Date(to)

    const salesFilter = Object.keys(dateFilter).length ? { invoiceDate: dateFilter, isReturn: false } : { isReturn: false }
    const purchaseFilter = Object.keys(dateFilter).length
      ? { createdAt: dateFilter, orderType: 'supplier', status: PURCHASE_ORDER_STATUS.INVOICED }
      : { orderType: 'supplier', status: PURCHASE_ORDER_STATUS.INVOICED }

    const [salesAgg, purchaseAgg] = await Promise.all([
      SalesInvoice.aggregate([
        { $match: salesFilter },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' }, gstCollected: { $sum: '$gstAmount' } } }
      ]),
      PurchaseOrder.aggregate([
        { $match: purchaseFilter },
        { $group: { _id: null, cogs: { $sum: '$invoiceAmount' }, gstPaid: { $sum: '$gstAmount' } } }
      ]),
    ])

    const revenue = salesAgg[0]?.revenue || 0
    const cogs    = purchaseAgg[0]?.cogs || 0
    const grossProfit = revenue - cogs
    const gstPayable  = (salesAgg[0]?.gstCollected || 0) - (purchaseAgg[0]?.gstPaid || 0)

    sendResponse(res, 200, {
      period: { from, to },
      revenue,
      costOfGoodsSold: cogs,
      grossProfit,
      grossMarginPct: revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(2)) : 0,
      gstPayable: parseFloat(gstPayable.toFixed(2)),
    })
  } catch (err) { next(err) }
})

module.exports = router
