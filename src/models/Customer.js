const mongoose = require('mongoose')

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
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
  panNumber: {
    type: String,
    trim: true,
  },
  aadharNumber: {
    type: String,
    trim: true,
  },
  // KYC
  idProofType: {
    type: String,
    enum: ['Aadhaar', 'PAN', 'Passport', 'DrivingLicense', 'VoterId', 'Other'],
  },
  idProofNumber: {
    type: String,
    trim: true,
  },
  // Personal details for relationship management
  birthday: {
    type: String, // DD-MM format for yearly reminders
  },
  anniversary: {
    type: String, // DD-MM format
  },
  // Financials
  outstandingBalance: {
    type: Number,
    default: 0,
    comment: 'Positive = customer owes shop; Negative = shop owes customer (advance)',
  },
  totalPurchaseValue: {
    type: Number,
    default: 0,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true })

module.exports = mongoose.model('Customer', customerSchema)
