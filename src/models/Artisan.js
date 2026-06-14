const mongoose = require('mongoose')

const artisanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Artisan name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    unique: true,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  speciality: {
    type: [String],
    comment: 'e.g. ["Ring", "Necklace", "Filigree"]',
  },
  allowedWastagePct: {
    type: Number,
    default: 2,
    comment: 'Maximum allowed gold wastage percentage per order',
  },
  // Running totals for accountability
  totalGoldIssued: {
    type: Number,
    default: 0,
    comment: 'Lifetime total gold issued in grams',
  },
  totalGoldReturned: {
    type: Number,
    default: 0,
    comment: 'Lifetime total gold returned in grams',
  },
  currentGoldWithArtisan: {
    type: Number,
    default: 0,
    comment: 'Gold currently held by artisan in grams',
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

module.exports = mongoose.model('Artisan', artisanSchema)
