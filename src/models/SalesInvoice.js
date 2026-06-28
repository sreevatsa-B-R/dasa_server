const mongoose = require('mongoose')
const { PAYMENT_MODES } = require('../config/constants')

const invoiceItemSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  itemCode: String,
  itemName: String,
  hsnCode: String,
  metal: { type: String, enum: ['gold', 'silver'], default: 'gold' },
  purity: String,
  grossWeight: Number,
  netWeight: Number,
  stoneWeight: Number,
  wastage: Number,
  goldRateUsed: Number,       // rate per gram at time of sale
  goldValue: Number,          // netWeight * goldRateUsed
  makingCharge: Number,
  stoneCharge: Number,
  subTotal: Number,
}, { _id: false })

const paymentDetailSchema = new mongoose.Schema({
  mode: { type: String, enum: PAYMENT_MODES },
  amount: Number,
  reference: String,          // cheque no / UPI transaction ID
}, { _id: false })

const salesInvoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    // Optional: invoices can be created with inline customer details (guest purchases)
    required: false,
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  items: [invoiceItemSchema],

  // Old gold exchange
  oldGoldGrossWeight: { type: Number, default: 0 },
  oldGoldDustWeight: { type: Number, default: 0 },
  oldGoldWeight: { type: Number, default: 0 },
  oldGoldPurity: { type: String },
  oldGoldRate:   { type: Number, default: 0 },
  oldGoldPricePerGram: { type: Number, default: 0 },
  oldGoldGstMode: { type: String, enum: ['with_gst', 'without_gst'], default: 'without_gst' },
  oldGoldGrossValue: { type: Number, default: 0 },
  oldGoldTaxableValue: { type: Number, default: 0 },
  oldGoldGstAmount: { type: Number, default: 0 },
  oldGoldValue:  { type: Number, default: 0 },

  // Customer tax/KYC details at time of sale
  customerAadharNumber: { type: String, trim: true },
  customerPanNumber: { type: String, trim: true },

  // Totals
  subTotal:       { type: Number, required: true },
  discount:       { type: Number, default: 0 },
  taxableAmount:  { type: Number },
  gstRate:        { type: Number, default: 3 },   // 3% GST on jewellery
  gstAmount:      { type: Number, default: 0 },
  totalAmount:    { type: Number, required: true },
  amountPaid:     { type: Number, default: 0 },
  balanceDue:     { type: Number, default: 0 },

  payments: [paymentDetailSchema],

  // If this invoice was created from a customer order
  customerOrderRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerOrder',
  },

  notes: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  isReturn: { type: Boolean, default: false },
  returnOf:  { type: mongoose.Schema.Types.ObjectId, ref: 'SalesInvoice' },
}, { timestamps: true })

// Auto-generate invoice number
// Auto-generate invoice number
salesInvoiceSchema.pre('save', async function () {
  if (!this.invoiceNumber) {
    const count = await mongoose.model('SalesInvoice').countDocuments()
    const year = new Date().getFullYear().toString().slice(-2)
    this.invoiceNumber = `INV${year}${String(count + 1).padStart(5, '0')}`
  }
})

module.exports = mongoose.model('SalesInvoice', salesInvoiceSchema)
