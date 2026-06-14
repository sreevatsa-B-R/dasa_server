const GoldRate = require('../models/GoldRate')
const { sendResponse, sendError } = require('../utils/response')

const todayStr = () => new Date().toISOString().split('T')[0]

// @desc  Set today's gold rate
// @route POST /api/v1/gold-rates
const setGoldRate = async (req, res, next) => {
  try {
    const { rate18K, rate14K, rate22K, rate24K } = req.body

    if (!rate18K || !rate14K || !rate22K || !rate24K) {
      return sendError(res, 400, 'All four karat rates are required')
    }

    const date = todayStr()
    const goldRate = await GoldRate.findOneAndUpdate(
      { date },
      { rate18K, rate14K, rate22K, rate24K, enteredBy: req.user._id },
      { upsert: true, new: true }
    )

    sendResponse(res, 200, goldRate, 'Gold rate updated for today')
  } catch (err) {
    next(err)
  }
}

// @desc  Get today's gold rate (fallback to yesterday if not set)
// @route GET /api/v1/gold-rates/today
const getTodayRate = async (req, res, next) => {
  try {
    let rate = await GoldRate.getTodayRateWithFallback()
    if (rate) {
      rate = await rate.populate('enteredBy', 'name')
    }
    if (!rate) return sendError(res, 404, 'No gold rate found')
    sendResponse(res, 200, rate)
  } catch (err) {
    next(err)
  }
}

// @desc  Get gold rate history
// @route GET /api/v1/gold-rates?from=YYYY-MM-DD&to=YYYY-MM-DD
const getRateHistory = async (req, res, next) => {
  try {
    const { from, to } = req.query
    const filter = {}
    if (from || to) {
      filter.date = {}
      if (from) filter.date.$gte = from
      if (to)   filter.date.$lte = to
    }
    const rates = await GoldRate.find(filter).sort({ date: -1 }).populate('enteredBy', 'name')
    sendResponse(res, 200, rates)
  } catch (err) {
    next(err)
  }
}

// @desc  Get gold rate for a specific date
// @route GET /api/v1/gold-rates/:date
const getRateByDate = async (req, res, next) => {
  try {
    const rate = await GoldRate.findOne({ date: req.params.date }).populate('enteredBy', 'name')
    if (!rate) return sendError(res, 404, `No gold rate found for ${req.params.date}`)
    sendResponse(res, 200, rate)
  } catch (err) {
    next(err)
  }
}

module.exports = { setGoldRate, getTodayRate, getRateHistory, getRateByDate }
