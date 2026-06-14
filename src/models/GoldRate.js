const mongoose = require('mongoose')

const goldRateSchema = new mongoose.Schema({
  date: {
    type: String, // stored as YYYY-MM-DD for easy lookup
    required: true,
    unique: true,
  },
  rate18K: { type: Number, required: true }, // per gram
  rate14K: { type: Number, required: true },
  rate22K: { type: Number, required: true },
  rate24K: { type: Number, required: true },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true })

// Helper: get rate for a specific karat
goldRateSchema.methods.getRateForKarat = function (karat) {
  const map = { '18K': this.rate18K, '14K': this.rate14K, '22K': this.rate22K, '24K': this.rate24K }
  return map[karat] || null
}

// Static method: Get today's rate, fallback to yesterday if not available
goldRateSchema.statics.getTodayRateWithFallback = async function () {
  const todayStr = new Date().toISOString().split('T')[0]
  
  // Try to get today's rate
  let rate = await this.findOne({ date: todayStr })
  if (rate) return rate
  
  // If today's rate not found, get the most recent rate before today
  rate = await this.findOne({ date: { $lt: todayStr } }).sort({ date: -1 })
  return rate
}

module.exports = mongoose.model('GoldRate', goldRateSchema)
