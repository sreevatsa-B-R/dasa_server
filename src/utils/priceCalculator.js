/**
 * Core gold price calculation logic for the ERP.
 * Used by sales, orders, and estimation endpoints.
 */

/**
 * Calculate the total price for a single jewellery item
 * @param {Object} params
 * @param {number} params.netWeight        - Net gold weight in grams
 * @param {number} params.goldRatePerGram  - Today's gold rate per gram for the item's purity
 * @param {number} params.makingCharge     - Making charge per gram (0 if using fixed)
 * @param {number} params.makingChargeFixed- Fixed making charge (used if per-gram is 0)
 * @param {number} params.stoneCharge      - Stone / diamond charge (flat)
 * @param {number} params.gstRate          - GST percentage (default 3%)
 * @returns {Object} Detailed price breakdown
 */
const calculateItemPrice = ({
  netWeight,
  goldRatePerGram,
  makingCharge = 0,
  makingChargeFixed = 0,
  stoneCharge = 0,
  gstRate = 3,
}) => {
  // Normalize numeric inputs (handle nulls and string numbers)
  const nw = Number(netWeight) || 0
  const rate = (goldRatePerGram === null || goldRatePerGram === undefined) ? null : Number(goldRatePerGram)
  const mc = makingCharge ?? 0
  const mcf = makingChargeFixed ?? 0
  const sc = (stoneCharge === null || stoneCharge === undefined) ? 0 : Number(stoneCharge)
  const gst = gstRate ?? 3

  // Validate that goldRatePerGram is provided
  if (rate === null || isNaN(rate) || rate <= 0) {
    throw new Error('Gold rate per gram is required to calculate price')
  }

  const goldValue = nw * rate
  const makingValue = (mc > 0) ? (nw * Number(mc)) : Number(mcf || 0)
  const subTotal = goldValue + makingValue + sc
  const gstAmount = parseFloat(((subTotal * gst) / 100).toFixed(2))
  const totalAmount = parseFloat((subTotal + gstAmount).toFixed(2))

  return {
    goldValue: parseFloat(goldValue.toFixed(2)),
    makingValue: parseFloat(makingValue.toFixed(2)),
    stoneCharge: parseFloat(sc.toFixed(2)),
    subTotal: parseFloat(subTotal.toFixed(2)),
    gstRate: gst,
    gstAmount,
    totalAmount,
  }
}

/**
 * Calculate the buyback value of old gold being exchanged
 * @param {number} weight         - Weight in grams
 * @param {string} purity         - e.g. '22K'
 * @param {Object} goldRates      - Today's gold rate object { rate18K, rate14K, rate22K, rate24K }
 * @param {number} [deductionPct] - Optional deduction % applied to buyback (e.g. 5%)
 * @returns {Object}
 */
const calculateOldGoldValue = (weight, purity, goldRates, deductionPct = 0) => {
  const rateMap = {
    '18K': goldRates.rate18K,
    '14K': goldRates.rate14K,
    '22K': goldRates.rate22K,
    '24K': goldRates.rate24K,
    'Silver': goldRates.rateSilver || 0,
    '92.5': goldRates.rateSilver ? Math.round(goldRates.rateSilver * 0.925) : 0,
    '99.9': goldRates.rateSilver ? Math.round(goldRates.rateSilver * 0.999) : 0,
  }
  const ratePerGram = rateMap[purity]
  if (ratePerGram === undefined) throw new Error(`Invalid purity: ${purity}`)

  const grossValue = weight * ratePerGram
  const deduction = (grossValue * deductionPct) / 100
  const buybackValue = parseFloat((grossValue - deduction).toFixed(2))

  return {
    weight,
    purity,
    ratePerGram,
    grossValue: parseFloat(grossValue.toFixed(2)),
    deductionPct,
    deduction: parseFloat(deduction.toFixed(2)),
    buybackValue,
  }
}

/**
 * Calculate old gold value using a manually entered rate per gram.
 * If GST is included in the entered rate, the taxable deduction is derived by
 * removing the GST component from the gross value.
 * @param {number} weight
 * @param {number} ratePerGram
 * @param {'with_gst'|'without_gst'} gstMode
 * @returns {Object}
 */
const calculateManualOldGoldValue = (weight, ratePerGram, gstMode = 'without_gst') => {
  const w = Number(weight) || 0
  const rate = Number(ratePerGram) || 0
  const mode = gstMode === 'with_gst' ? 'with_gst' : 'without_gst'

  if (w <= 0 || rate <= 0) {
    return {
      weight: w,
      ratePerGram: rate,
      gstMode: mode,
      grossValue: 0,
      taxableValue: 0,
      gstAmount: 0,
      totalValue: 0,
    }
  }

  const grossValue = parseFloat((w * rate).toFixed(2))
  const taxableValue = mode === 'with_gst'
    ? parseFloat((grossValue / 1.03).toFixed(2))
    : grossValue
  const gstAmount = parseFloat((grossValue - taxableValue).toFixed(2))

  return {
    weight: w,
    ratePerGram: rate,
    gstMode: mode,
    grossValue,
    taxableValue,
    gstAmount,
    totalValue: grossValue,
  }
}

/**
 * Calculate wastage percentage
 * @param {number} goldIssued   - Grams issued to artisan
 * @param {number} goldReturned - Grams returned by artisan (finished item weight)
 * @returns {Object}
 */
const calculateWastage = (goldIssued, goldReturned) => {
  if (goldIssued <= 0) return { wastageWeight: 0, wastagePct: 0 }
  const wastageWeight = parseFloat((goldIssued - goldReturned).toFixed(3))
  const wastagePct = parseFloat(((wastageWeight / goldIssued) * 100).toFixed(2))
  return { wastageWeight, wastagePct }
}

module.exports = { calculateItemPrice, calculateOldGoldValue, calculateManualOldGoldValue, calculateWastage }
