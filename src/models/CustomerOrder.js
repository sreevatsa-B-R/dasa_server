const mongoose = require('mongoose')
const { ORDER_STATUS, KARAT_TYPES, PAYMENT_MODES } = require('../config/constants')

const advancePaymentSchema = new mongoose.Schema({
  amount: Number,
  mode: { type: String, enum: PAYMENT_MODES },
  reference: String,
  date: { type: Date, default: Date.now },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false })

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: Object.values(ORDER_STATUS) },
  changedAt: { type: Date, default: Date.now },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { _id: false })

const customerOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  // Order details
  itemDescription:  { type: String, required: true, trim: true },
  category:         { type: String },
  purity:           { type: String, enum: KARAT_TYPES },
  estimatedWeight:  { type: Number },   // in grams
  agreedGoldRate:   { type: Number },   // gold rate locked at order time
  makingCharge:     { type: Number, default: 0 },
  stoneCharge:      { type: Number, default: 0 },
  estimatedAmount:  { type: Number },
  designNotes:      { type: String, trim: true },
  designImageUrl:   { type: String },   // photo reference upload path

  // Dates
  orderDate:        { type: Date, default: Date.now },
  expectedDelivery: { type: Date, required: true },
  actualDelivery:   { type: Date },

  // Status
  status: {
    type: String,
    enum: Object.values(ORDER_STATUS),
    default: ORDER_STATUS.NEW,
  },
  statusHistory: [statusHistorySchema],

  // Artisan assignment
  assignedArtisan: { type: mongoose.Schema.Types.ObjectId, ref: 'Artisan' },
  goldIssuedToArtisan: { type: Number, default: 0 },  // grams
  goldIssuedDate:      { type: Date },

  // On completion
  actualWeight:   { type: Number },   // final confirmed weight
  finalAmount:    { type: Number },
  wastageWeight:  { type: Number },

  // Payments
  advancePayments: [advancePaymentSchema],
  totalAdvancePaid: { type: Number, default: 0 },
  balanceDue:       { type: Number, default: 0 },

  // Linked invoice on delivery
  salesInvoice: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice' },

  notes: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// Auto-generate order number
customerOrderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    const self = this
    return mongoose.model('CustomerOrder').countDocuments().then(count => {
      const year = new Date().getFullYear().toString().slice(-2)
      self.orderNumber = `ORD${year}${String(count + 1).padStart(5, '0')}`
    })
  }

})

module.exports = mongoose.model('CustomerOrder', customerOrderSchema)
