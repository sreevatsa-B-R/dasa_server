const mongoose = require('mongoose')
const { ITEM_CATEGORIES, KARAT_TYPES, ITEM_STATUS } = require('../config/constants')

const itemSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  itemCode: {
    type: String,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: ITEM_CATEGORIES,
    required: [true, 'Category is required'],
  },
  subCategory: {
    type: String,
    trim: true,
  },
  metal: {
    type: String,
    enum: ['gold', 'silver'],
    default: 'gold',
  },
  purity: {
    type: String,
    enum: KARAT_TYPES,
    required: [true, 'Purity is required'],
  },
  grossWeight: {
    type: Number,
    required: [true, 'Gross weight is required'],
    min: 0,
  },
  netWeight: {
    type: Number,
    required: [true, 'Net weight is required'],
    min: 0,
  },
  stoneWeight: {
    type: Number,
    default: 0,
  },
  wastage: {
    type: Number,
    default: 0,
  },
  makingCharge: {
    type: Number,
    default: 0,
    comment: 'Per gram making charge',
  },
  makingChargeFixed: {
    type: Number,
    default: 0,
    comment: 'Fixed making charge (used if per-gram is 0)',
  },
  stoneCharge: {
    type: Number,
    default: 0,
  },
  huidNumber: {
    type: String,
    trim: true,
    comment: 'Hallmark Unique Identification (HUID) number',
  },
  hsnCode: {
    type: String,
    default: '711319',
    trim: true,
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: Object.values(ITEM_STATUS),
    default: ITEM_STATUS.IN_STOCK,
  },
  description: {
    type: String,
    trim: true,
  },
  minimumStock: {
    type: Number,
    default: 1,
    comment: 'Trigger low stock alert below this quantity',
  },
  // Track which purchase order brought this item in
  purchaseOrderRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
  },
  customerOrderRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerOrder',
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true })

// Auto-generate item code before saving
itemSchema.pre('save', async function () {
  if (!this.itemCode) {
    const count = await mongoose.model('Item').countDocuments()
    this.itemCode = `ITM${String(count + 1).padStart(5, '0')}`
  }
  if (!this.barcode) {
    this.barcode = this.itemCode
  }
})

module.exports = mongoose.model('Item', itemSchema)
