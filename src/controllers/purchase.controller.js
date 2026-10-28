const PurchaseOrder = require('../models/PurchaseOrder')
const Supplier = require('../models/Supplier')
const Item = require('../models/Item')
const JournalEntry = require('../models/JournalEntry')
const { PURCHASE_ORDER_STATUS, ITEM_STATUS, JOURNAL_TYPES } = require('../config/constants')
const { sendResponse, sendError } = require('../utils/response')
const { calculatePurchaseInvoiceTotals } = require('../utils/purchaseInvoiceTotals')

// ── Suppliers ─────────────────────────────────────────────

const createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, addedBy: req.user._id })
    try {
      const Artisan = require('../models/Artisan')
      await Artisan.create({
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address || '',
        speciality: [],
        allowedWastagePct: 2,
        addedBy: req.user._id
      })
    } catch (e) {}
    sendResponse(res, 201, supplier, 'Supplier created')
  } catch (err) { next(err) }
}

const getSuppliers = async (req, res, next) => {
  try {
    const { search } = req.query
    const filter = { isActive: true }
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ]
    const suppliers = await Supplier.find(filter).sort({ name: 1 })
    sendResponse(res, 200, suppliers)
  } catch (err) { next(err) }
}

const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id)
    if (!supplier) return sendError(res, 404, 'Supplier not found')
    // Include recent purchase orders
    const recentOrders = await PurchaseOrder.find({ supplier: req.params.id, orderType: 'supplier' })
      .sort({ createdAt: -1 }).limit(10)
    sendResponse(res, 200, { supplier, recentOrders })
  } catch (err) { next(err) }
}

const updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!supplier) return sendError(res, 404, 'Supplier not found')
    sendResponse(res, 200, supplier, 'Supplier updated')
  } catch (err) { next(err) }
}

// ── Purchase Orders ───────────────────────────────────────

const createPurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.create({
      ...req.body,
      orderType: 'supplier',
      status: PURCHASE_ORDER_STATUS.RAISED,
      createdBy: req.user._id,
    })
    sendResponse(res, 201, order, 'Purchase order created')
  } catch (err) { next(err) }
}

const getPurchaseOrders = async (req, res, next) => {
  try {
    const { supplierId, status, page = 1, limit = 20 } = req.query
    const filter = { orderType: 'supplier' }
    if (supplierId) {
      filter.$or = [
        { supplier: supplierId },
        { artisan: supplierId }
      ]
    }
    if (status)     filter.status = status

    const total = await PurchaseOrder.countDocuments(filter)
    const orders = await PurchaseOrder.find(filter)
      .populate('supplier', 'name phone')
      .populate('artisan', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    sendResponse(res, 200, { total, page: Number(page), orders })
  } catch (err) { next(err) }
}

const getPurchaseOrderById = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findById(req.params.id)
      .populate('supplier')
      .populate('artisan')
    if (!order) return sendError(res, 404, 'Purchase order not found')
    sendResponse(res, 200, order)
  } catch (err) { next(err) }
}

const updatePurchaseOrder = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!order) return sendError(res, 404, 'Purchase order not found')
    sendResponse(res, 200, order, 'Purchase order updated')
  } catch (err) { next(err) }
}

// @desc  Receive goods against a PO (GRN)
const receiveGoods = async (req, res, next) => {
  try {
    const { receivedWeight, purityCertRef, items } = req.body
    const order = await PurchaseOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Purchase order not found')

    order.receivedWeight = receivedWeight
    order.receivedDate = new Date()
    order.purityCertRef = purityCertRef
    order.status = PURCHASE_ORDER_STATUS.RECEIVED

    await order.save()

    // Add each received item to inventory
    const createdItems = []
    if (items && items.length > 0) {
      for (const itemData of items) {
        const item = await Item.create({
          ...itemData,
          storeId: req.user._id,
          status: ITEM_STATUS.IN_STOCK,
          purchaseOrderRef: order._id,
          addedBy: req.user._id,
        })
        createdItems.push(item)
      }
    }

    sendResponse(res, 200, { order, createdItems }, 'Goods received and stock updated')
  } catch (err) { next(err) }
}

// @desc  Create purchase invoice from received PO
const createPurchaseInvoice = async (req, res, next) => {
  try {
    const { invoiceNumber, invoiceAmount, gstAmount } = req.body
    const order = await PurchaseOrder.findById(req.params.id)
    if (!order) return sendError(res, 404, 'Purchase order not found')
    if (order.status === PURCHASE_ORDER_STATUS.INVOICED || order.totalInvoiceAmt !== undefined) {
      return sendError(res, 409, 'A purchase invoice has already been recorded for this order')
    }

    let invoiceTotals
    try {
      invoiceTotals = calculatePurchaseInvoiceTotals(invoiceAmount, gstAmount)
    } catch (err) {
      if (err instanceof RangeError) return sendError(res, 400, err.message)
      throw err
    }

    order.invoiceNumber = invoiceNumber
    order.invoiceAmount = invoiceTotals.invoiceAmount
    order.gstAmount = invoiceTotals.gstAmount
    order.totalInvoiceAmt = invoiceTotals.totalInvoiceAmt
    order.balanceDue = order.totalInvoiceAmt - order.totalPaid
    order.status = PURCHASE_ORDER_STATUS.INVOICED

    await order.save()

    // Update supplier balance
    await Supplier.findByIdAndUpdate(order.supplier, {
      $inc: { currentBalance: order.totalInvoiceAmt }
    })

    // Auto journal entry
    await JournalEntry.create({
      type: JOURNAL_TYPES.PURCHASE,
      debitAccount: 'Purchase / Stock',
      creditAccount: 'Accounts Payable',
      amount: order.totalInvoiceAmt,
      narration: `Purchase Invoice ${invoiceNumber}`,
      referenceType: 'PurchaseOrder',
      referenceId: order._id,
      isAutoGenerated: true,
      createdBy: req.user._id,
    })

    sendResponse(res, 200, order, 'Purchase invoice created')
  } catch (err) { next(err) }
}

// @desc  Record payment to supplier
const recordPayment = async (req, res, next) => {
  try {
    const { supplierId, purchaseOrderId, amount, mode, reference } = req.body

    const order = await PurchaseOrder.findById(purchaseOrderId)
    if (!order) return sendError(res, 404, 'Purchase order not found')
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return sendError(res, 400, 'Payment amount must be a positive number')
    }
    if (supplierId && String(order.supplier) !== String(supplierId)) {
      return sendError(res, 400, 'Supplier does not match the purchase order')
    }
    if (paymentAmount > (order.balanceDue || 0)) {
      return sendError(res, 400, 'Payment exceeds the outstanding balance')
    }

    order.payments.push({ amount: paymentAmount, mode, reference, paidBy: req.user._id })
    order.totalPaid += paymentAmount
    order.balanceDue = Math.max(0, order.totalInvoiceAmt - order.totalPaid)

    await order.save()
    await Supplier.findByIdAndUpdate(order.supplier, { $inc: { currentBalance: -paymentAmount } })

    sendResponse(res, 200, order, 'Payment recorded')
  } catch (err) { next(err) }
}

// @desc  Get payment history for a supplier
const getSupplierPayments = async (req, res, next) => {
  try {
    const orders = await PurchaseOrder.find({
      supplier: req.params.supplierId,
      orderType: 'supplier',
      'payments.0': { $exists: true },
    }).select('poNumber invoiceNumber totalInvoiceAmt totalPaid balanceDue payments')

    sendResponse(res, 200, orders)
  } catch (err) { next(err) }
}

module.exports = {
  createSupplier, getSuppliers, getSupplierById, updateSupplier,
  createPurchaseOrder, getPurchaseOrders, getPurchaseOrderById, updatePurchaseOrder,
  receiveGoods, createPurchaseInvoice, recordPayment, getSupplierPayments,
}
