const SalesInvoice = require('../models/SalesInvoice')
const Item = require('../models/Item')
const Customer = require('../models/Customer')
const GoldRate = require('../models/GoldRate')
const JournalEntry = require('../models/JournalEntry')
const { ITEM_STATUS, JOURNAL_TYPES } = require('../config/constants')
const { calculateItemPrice, calculateOldGoldValue, calculateManualOldGoldValue } = require('../utils/priceCalculator')
const { generateInvoiceFile } = require('../utils/invoicePdf')
const { sendResponse, sendError } = require('../utils/response')

const todayStr = () => new Date().toISOString().split('T')[0]

// @desc  Create sales invoice
// @route POST /api/v1/sales/invoices
const createInvoice = async (req, res, next) => {
  try {
    const { customerId, customerName, customerPhone, aadharNumber, panNumber, items, payments, discount = 0, oldGold, notes, customerOrderRef } = req.body

    // Resolve customer: priority -> customerId -> customerPhone lookup -> create by provided name/phone
    let customer = null
    if (customerId) {
      customer = await Customer.findById(customerId)
      if (!customer) return sendError(res, 404, 'Customer not found')
    } else if (customerPhone) {
      customer = await Customer.findOne({ phone: customerPhone })
    }

    if (customer && (aadharNumber || panNumber)) {
      const customerUpdates = {}
      if (aadharNumber && !customer.aadharNumber) customerUpdates.aadharNumber = String(aadharNumber).trim()
      if (panNumber && !customer.panNumber) customerUpdates.panNumber = String(panNumber).trim().toUpperCase()
      if (Object.keys(customerUpdates).length > 0) {
        customer = await Customer.findByIdAndUpdate(customer._id, customerUpdates, { new: true })
      }
    }

    if (!customer && customerName) {
      // create minimal customer record (if phone is unique it will be used)
      try {
        customer = await Customer.create({
          name: customerName.trim(),
          phone: customerPhone ? String(customerPhone).trim() : `+91-guest-${Date.now()}`,
          aadharNumber: aadharNumber ? String(aadharNumber).trim() : undefined,
          panNumber: panNumber ? String(panNumber).trim().toUpperCase() : undefined,
          addedBy: req.user._id,
        })
      } catch (err) {
        // If unique phone constraint fails, try to fetch existing
        if (err.code === 11000 && customerPhone) {
          customer = await Customer.findOne({ phone: customerPhone })
        } else {
          // fallback to anonymous customer object
          customer = null
        }
      }
    }

    const goldRate = await GoldRate.getTodayRateWithFallback()
    if (!goldRate) return sendError(res, 400, 'No gold rate found')

    // Build invoice items
    const invoiceItems = []
    let subTotal = 0

    for (const entry of items) {
      const item = await Item.findById(entry.itemId)
      if (!item || item.isDeleted) return sendError(res, 404, `Item ${entry.itemId} not found`)
      if (item.status !== ITEM_STATUS.IN_STOCK) return sendError(res, 400, `Item ${item.name} is not available for sale`)

      const rate = goldRate.getRateForKarat(item.purity)
      if (!rate) return sendError(res, 400, `No gold rate found for purity ${item.purity}`)

      const price = calculateItemPrice({
        netWeight: item.netWeight,
        goldRatePerGram: rate,
        makingCharge: item.makingCharge,
        makingChargeFixed: item.makingChargeFixed,
        stoneCharge: item.stoneCharge,
        gstRate: 0, // GST calculated at invoice level
      })

      invoiceItems.push({
        item: item._id,
        itemCode: item.itemCode,
        itemName: item.name,
        hsnCode: entry.hsnCode || item.hsnCode || '711319',
        metal: item.metal || 'gold',
        purity: item.purity,
        grossWeight: item.grossWeight,
        netWeight: item.netWeight,
        stoneWeight: item.stoneWeight,
        wastage: item.wastage,
        goldRateUsed: rate,
        goldValue: price.goldValue,
        makingCharge: price.makingValue,
        stoneCharge: price.stoneCharge,
        subTotal: price.subTotal,
      })

      subTotal += price.subTotal

      // Mark item as sold
      await Item.findByIdAndUpdate(item._id, { status: ITEM_STATUS.SOLD })
    }

    // Old gold deduction
    let oldGoldValue = 0
    let oldGoldData = {}
    if (oldGold && oldGold.weight > 0) {
      const ogCalc = oldGold.pricePerGram || oldGold.ratePerGram
        ? calculateManualOldGoldValue(oldGold.weight, oldGold.pricePerGram ?? oldGold.ratePerGram, oldGold.gstMode)
        : calculateOldGoldValue(oldGold.weight, oldGold.purity, goldRate)

      oldGoldValue = ogCalc.taxableValue ?? ogCalc.buybackValue
      oldGoldData = {
        oldGoldGrossWeight: oldGold.grossWeight || 0,
        oldGoldDustWeight: oldGold.dustWeight || 0,
        oldGoldWeight: oldGold.weight,
        oldGoldPurity: oldGold.purity,
        oldGoldRate: ogCalc.ratePerGram ?? 0,
        oldGoldPricePerGram: ogCalc.ratePerGram ?? oldGold.pricePerGram ?? oldGold.ratePerGram,
        oldGoldGstMode: ogCalc.gstMode ?? 'without_gst',
        oldGoldGrossValue: ogCalc.grossValue ?? ogCalc.buybackValue ?? 0,
        oldGoldTaxableValue: oldGoldValue,
        oldGoldGstAmount: ogCalc.gstAmount ?? 0,
        oldGoldValue,
      }
    }

    const taxableAmount = Math.max(0, subTotal - oldGoldValue)
    const gstRate = 3
    const gstAmount = parseFloat(((taxableAmount * gstRate) / 100).toFixed(2))
    const totalAmount = Math.max(0, parseFloat((taxableAmount + gstAmount - discount).toFixed(2)))
    const amountPaid = payments ? payments.reduce((sum, p) => sum + p.amount, 0) : 0
    const balanceDue = parseFloat((totalAmount - amountPaid).toFixed(2))

    const invoicePanNumber = customer?.panNumber || (panNumber ? String(panNumber).trim().toUpperCase() : '')
    if (totalAmount > 199999 && !invoicePanNumber) {
      return sendError(res, 400, 'PAN card number is mandatory for transactions above ₹1,99,999')
    }

    const invoice = await SalesInvoice.create({
      customer: customer ? customer._id : undefined,
      customerAadharNumber: aadharNumber ? String(aadharNumber).trim() : undefined,
      customerPanNumber: invoicePanNumber || undefined,
      items: invoiceItems,
      ...oldGoldData,
      subTotal,
      discount,
      taxableAmount,
      gstRate,
      gstAmount,
      totalAmount,
      amountPaid,
      balanceDue,
      payments: payments || [],
      customerOrderRef,
      notes,
      createdBy: req.user._id,
    })

    if (customerOrderRef) {
      const CustomerOrder = require('../models/CustomerOrder')
      const order = await CustomerOrder.findById(customerOrderRef)
      if (order) {
        order.salesInvoice = invoice._id
        order.status = 'delivered'
        order.actualDelivery = new Date()
        order.finalAmount = totalAmount
        order.statusHistory.push({
          status: 'delivered',
          changedBy: req.user._id,
          note: `Invoice ${invoice.invoiceNumber} created`
        })
        await order.save()
      }
    }

    // Auto journal entry
    await JournalEntry.create({
      type: JOURNAL_TYPES.SALE,
      debitAccount: 'Cash/Bank',
      creditAccount: 'Sales Revenue',
      amount: totalAmount,
      narration: `Sale Invoice ${invoice.invoiceNumber}`,
      referenceType: 'SalesInvoice',
      referenceId: invoice._id,
      isAutoGenerated: true,
      createdBy: req.user._id,
    })

    // Update customer total purchase value (if customer exists)
    if (customer) {
      await Customer.findByIdAndUpdate(customer._id, { $inc: { totalPurchaseValue: totalAmount } })
    }

    sendResponse(res, 201, invoice, 'Invoice created successfully')
  } catch (err) {
    next(err)
  }
}

// @desc  Get all invoices
// @route GET /api/v1/sales/invoices?from=&to=&customerId=
const getInvoices = async (req, res, next) => {
  try {
    const { from, to, customerId, page = 1, limit = 20 } = req.query
    const filter = { isReturn: false }

    if (customerId) filter.customer = customerId
    if (from || to) {
      filter.invoiceDate = {}
      if (from) filter.invoiceDate.$gte = new Date(from)
      if (to)   filter.invoiceDate.$lte = new Date(to)
    }

    const total = await SalesInvoice.countDocuments(filter)
    const invoices = await SalesInvoice.find(filter)
      .populate('customer', 'name phone')
      .sort({ invoiceDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))

    sendResponse(res, 200, { total, page: Number(page), invoices })
  } catch (err) {
    next(err)
  }
}

// @desc  Get single invoice
// @route GET /api/v1/sales/invoices/:id
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await SalesInvoice.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name')
    if (!invoice) return sendError(res, 404, 'Invoice not found')
    sendResponse(res, 200, invoice)
  } catch (err) {
    next(err)
  }
}

// @desc  Process sales return
// @route POST /api/v1/sales/invoices/:id/return
const processReturn = async (req, res, next) => {
  try {
    const { reason, itemIds } = req.body
    const original = await SalesInvoice.findById(req.params.id)
    if (!original) return sendError(res, 404, 'Invoice not found')

    // Return items to in_stock
    for (const itemId of itemIds) {
      await Item.findByIdAndUpdate(itemId, { status: ITEM_STATUS.IN_STOCK })
    }

    const returnInvoice = await SalesInvoice.create({
      customer: original.customer,
      items: original.items.filter(i => itemIds.includes(i.item.toString())),
      totalAmount: -original.totalAmount,
      amountPaid: -original.amountPaid,
      balanceDue: 0,
      isReturn: true,
      returnOf: original._id,
      notes: reason,
      createdBy: req.user._id,
    })

    sendResponse(res, 201, returnInvoice, 'Return processed successfully')
  } catch (err) {
    next(err)
  }
}

// @desc  Get receipt data
// @route GET /api/v1/sales/invoices/:id/receipt
const getReceipt = async (req, res, next) => {
  try {
    const invoice = await SalesInvoice.findById(req.params.id)
      .populate('customer', 'name phone address')
    if (!invoice) return sendError(res, 404, 'Invoice not found')
    // Returns full invoice — frontend formats for print/SMS
    sendResponse(res, 200, invoice)
  } catch (err) {
    next(err)
  }
}

// @desc  Get sales invoice as PDF
// @route GET /api/v1/sales/invoices/:id/pdf
const getInvoicePdf = async (req, res, next) => {
  try {
    const invoice = await SalesInvoice.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name')

    if (!invoice) return sendError(res, 404, 'Invoice not found')

    const pdfBuffer = await generateInvoiceFile(invoice)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber || 'invoice'}.pdf"`)
    res.status(200).send(pdfBuffer)
  } catch (err) {
    next(err)
  }
}

// @desc  Evaluate old gold (no invoice created)
// @route POST /api/v1/sales/old-gold
const evaluateOldGold = async (req, res, next) => {
  try {
    const { weight, purity, deductionPct = 0 } = req.body
    const goldRate = await GoldRate.getTodayRateWithFallback()
    if (!goldRate) return sendError(res, 400, 'No gold rate found')

    const result = calculateOldGoldValue(weight, purity, goldRate, deductionPct)
    sendResponse(res, 200, result)
  } catch (err) {
    next(err)
  }
}

// @desc  Price estimate (no invoice saved)
// @route POST /api/v1/sales/price-estimate
const priceEstimate = async (req, res, next) => {
  try {
    const { netWeight, purity, makingCharge = 0, makingChargeFixed = 0, stoneCharge = 0 } = req.body
    const goldRate = await GoldRate.getTodayRateWithFallback()
    if (!goldRate) return sendError(res, 400, 'No gold rate found')

    const rate = goldRate.getRateForKarat(purity)
    if (!rate) return sendError(res, 400, `No rate found for purity ${purity}`)

    const estimate = calculateItemPrice({ netWeight, goldRatePerGram: rate, makingCharge, makingChargeFixed, stoneCharge })
    sendResponse(res, 200, { purity, goldRateUsed: rate, ...estimate })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  createInvoice, getInvoices, getInvoiceById,
  processReturn, getReceipt, getInvoicePdf, evaluateOldGold, priceEstimate,
}
