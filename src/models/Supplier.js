const mongoose = require('mongoose')

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true,
  },
  contactPerson: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
  },
  alternatePhone: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  gstNumber: {
    type: String,
    trim: true,
  },
  panNumber: {
    type: String,
    trim: true,
  },
  bankName: {
    type: String,
    trim: true,
  },
  bankAccountNumber: {
    type: String,
    trim: true,
  },
  bankIfsc: {
    type: String,
    trim: true,
  },
  paymentTerms: {
    type: String,
    trim: true,
    comment: 'e.g. Net 30, Immediate, etc.',
  },
  currentBalance: {
    type: Number,
    default: 0,
    comment: 'Positive = we owe supplier; Negative = supplier owes us',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true })

module.exports = mongoose.model('Supplier', supplierSchema)
