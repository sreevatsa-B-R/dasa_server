const mongoose = require('mongoose')
const { PURCHASE_ORDER_STATUS, KARAT_TYPES, PAYMENT_MODES } = require('../config/constants')

const purchasePaymentSchema = new mongoose.Schema({
  amount: Number,
  mode: { type: String, enum: PAYMENT_MODES },
  reference: String,
  date: { type: Date, default: Date.now },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false })

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
  },
  // Source: either a supplier or a workshop/artisan order
  orderType: {
    type: String,
    enum: ['supplier', 'workshop'],
    required: true,
  },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  artisan:  { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' },

  // What was ordered
  itemDescription:  { type: String, required: true, trim: true },
  purity:           { type: String, enum: KARAT_TYPES },
  orderedWeight:    { type: Number },
  agreedRatePerGram:{ type: Number },
  estimatedAmount:  { type: Number },

  orderDate:        { type: Date, default: Date.now },
  expectedDate:     { type: Date },

  // Workshop / Artisan gold tracking
  goldIssuedWeight: { type: Number, default: 0 },
  goldIssuedDate:   { type: Date },

  // On receipt
  receivedWeight:   { type: Number },
  receivedDate:     { type: Date },
  wastageWeight:    { type: Number },
  wastagePct:       { type: Number },
  purityCertRef:    { type: String, trim: true },

  // Invoice
  invoiceNumber:    { type: String, trim: true },
  invoiceAmount:    { type: Number },
  gstAmount:        { type: Number, default: 0 },
  totalInvoiceAmt:  { type: Number },

  // Payments to supplier
  payments:         [purchasePaymentSchema],
  totalPaid:        { type: Number, default: 0 },
  balanceDue:       { type: Number, default: 0 },

  status: {
    type: String,
    enum: Object.values(PURCHASE_ORDER_STATUS),
    default: PURCHASE_ORDER_STATUS.RAISED,
  },

  // Link to customer order if this workshop order is for a specific customer
  customerOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerOrder' },

  notes:     { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// Auto-generate PO number
purchaseOrderSchema.pre('save', function (next) {
  if (!this.poNumber) {
    const self = this
    return mongoose.model('PurchaseOrder').countDocuments().then(count => {
      const year = new Date().getFullYear().toString().slice(-2)
      const prefix = self.orderType === 'workshop' ? 'WO' : 'PO'
      self.poNumber = `${prefix}${year}${String(count + 1).padStart(5, '0')}`
    })
  }
  next()
})

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema)
