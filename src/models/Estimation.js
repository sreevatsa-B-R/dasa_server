const mongoose = require('mongoose')
const { KARAT_TYPES, ITEM_CATEGORIES } = require('../config/constants')

const estimationItemSchema = new mongoose.Schema({
  name:             { type: String, required: true, trim: true },
  category:         { type: String, enum: [...ITEM_CATEGORIES, ''], trim: true },
  purity:           { type: String, enum: KARAT_TYPES, required: true },
  grossWeight:      { type: Number, default: 0 },
  netWeight:        { type: Number, required: true, min: 0 },
  stoneWeight:      { type: Number, default: 0 },
  // Rates used at estimation time
  goldRateUsed:     { type: Number, required: true },
  goldValue:        { type: Number, required: true },
  makingCharge:     { type: Number, default: 0 },       // per gram rate
  makingChargeFixed:{ type: Number, default: 0 },       // fixed charge
  makingValue:      { type: Number, default: 0 },       // resolved making amount
  stoneCharge:      { type: Number, default: 0 },
  subTotal:         { type: Number, required: true },   // before GST
  gstAmount:        { type: Number, default: 0 },
  totalAmount:      { type: Number, required: true },   // incl. GST
}, { _id: false })

const estimationSchema = new mongoose.Schema({
  estimateNumber: {
    type: String,
    unique: true,
  },

  // Customer details (optional — walk-in allowed)
  customerName:   { type: String, trim: true, default: 'Walk-in Customer' },
  customerPhone:  { type: String, trim: true },

  // Items
  items: {
    type: [estimationItemSchema],
    validate: { validator: v => v.length > 0, message: 'At least one item is required' },
  },

  // Gold rate reference
  goldRateDate: { type: String }, // YYYY-MM-DD of the rate used

  // Totals
  subTotal:       { type: Number, required: true },
  gstRate:        { type: Number, default: 3 },
  gstAmount:      { type: Number, default: 0 },
  totalAmount:    { type: Number, required: true },

  // Validity
  validDays:  { type: Number, default: 3, min: 1, max: 30 },
  validUntil: { type: Date, required: true },

  // Shop T&C snapshot (stored so reprints are consistent)
  terms: {
    type: [String],
    default: [
      'This estimate is valid for the mentioned days from date of issue.',
      'Prices are subject to change based on prevailing gold rates.',
      'GST @ 3% is included in the total amount.',
      'Making charges may vary for custom orders.',
      'This is not a sales invoice.',
    ],
  },

  notes:     { type: String, trim: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'converted'],
    default: 'active',
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

// Auto-generate estimate number: EST{YY}{00001}
estimationSchema.pre('save', async function () {
  if (!this.estimateNumber) {
    const count = await mongoose.model('Estimation').countDocuments()
    const year = new Date().getFullYear().toString().slice(-2)
    this.estimateNumber = `EST${year}${String(count + 1).padStart(5, '0')}`
  }
})

// Auto-expire: mark 'expired' if validUntil has passed
estimationSchema.virtual('isExpired').get(function () {
  return new Date() > this.validUntil
})

module.exports = mongoose.model('Estimation', estimationSchema)
