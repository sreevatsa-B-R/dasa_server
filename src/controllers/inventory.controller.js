const Item = require('../models/Item')
const GoldRate = require('../models/GoldRate')
const { ITEM_STATUS, ITEM_CATEGORIES } = require('../config/constants')
const { calculateItemPrice } = require('../utils/priceCalculator')
const { sendResponse, sendError } = require('../utils/response')
const { itemStoreFilter } = require('../utils/itemStoreScope')

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// @desc  Add new item
// @route POST /api/v1/inventory/items
const addItem = async (req, res, next) => {
  try {
    // Allow minimal payloads (category + subCategory) from quick-add UI
    const body = { ...req.body }
    const defaultName = (body.category || 'Item') + (body.subCategory ? ` - ${body.subCategory}` : '')
    const requestedName = String(body.name || defaultName).trim()

    const existingItem = await Item.findOne(itemStoreFilter(req.user._id, {
      name: { $regex: `^${escapeRegex(requestedName)}$`, $options: 'i' },
      isDeleted: false,
      status: ITEM_STATUS.IN_STOCK,
    }))

    if (existingItem) {
      return sendResponse(res, 200, existingItem, 'Item already exists, reusing the existing inventory item')
    }

    const payload = {
      name: requestedName || defaultName,
      storeId: req.user._id,
      category: body.category || 'Other',
      subCategory: body.subCategory,
      purity: body.purity || '22K',
      grossWeight: typeof body.grossWeight !== 'undefined' ? body.grossWeight : 0,
      netWeight: typeof body.netWeight !== 'undefined' ? body.netWeight : 0,
      stoneWeight: body.stoneWeight || 0,
      makingCharge: body.makingCharge || 0,
      makingChargeFixed: body.makingChargeFixed || 0,
      stoneCharge: body.stoneCharge || 0,
      wastage: body.wastage || 0,
      barcode: body.barcode,
      description: body.description,
      addedBy: req.user._id,
    }
    const item = await Item.create(payload)
    sendResponse(res, 201, item, 'Item added to inventory')
  } catch (err) {
    next(err)
  }
}

// @desc  Get all items with filters
// @route GET /api/v1/inventory/items?category=Ring&purity=22K&status=in_stock
const getItems = async (req, res, next) => {
  try {
    const { category, purity, status, search, page = 1, limit = 20 } = req.query
    const filter = itemStoreFilter(req.user._id, { isDeleted: false })

    if (category) filter.category = category
    if (purity)   filter.purity = purity
    if (status)   filter.status = status
    if (search)   filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ]

    const total = await Item.countDocuments(filter)
    const items = await Item.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 })

    // Attach live price if gold rate exists (today or most recent)
    let goldRate = null
    try {
      goldRate = await GoldRate.getTodayRateWithFallback()
    } catch (goldRateErr) {
      console.warn('⚠️  Warning fetching gold rate:', goldRateErr.message)
      // Continue without gold rate if fetch fails
    }

    const enriched = items.map(item => {
      const obj = item.toObject()
      if (goldRate) {
        const rate = goldRate.getRateForKarat(item.purity)
        if (rate) {
          try {
            const price = calculateItemPrice({
              netWeight: item.netWeight,
              goldRatePerGram: rate,
              makingCharge: item.makingCharge,
              makingChargeFixed: item.makingChargeFixed,
              stoneCharge: item.stoneCharge,
            })
            obj.livePrice = price
          } catch (priceErr) {
            console.warn(`⚠️  Cannot calculate price for item ${item.itemCode}:`, priceErr.message)
          }
        } else {
          console.warn(`⚠️  No rate found for purity ${item.purity}`)
        }
      }
      return obj
    })

    console.log('✅ Items retrieved:', { total, count: items.length })
    sendResponse(res, 200, { total, page: Number(page), limit: Number(limit), items: enriched })
  } catch (err) {
    console.error('❌ Error in getItems:', err.message)
    next(err)
  }
}

// @desc  Get single item
// @route GET /api/v1/inventory/items/:id
const getItemById = async (req, res, next) => {
  try {
    const item = await Item.findOne(itemStoreFilter(req.user._id, { _id: req.params.id }))
    if (!item || item.isDeleted) return sendError(res, 404, 'Item not found')
    sendResponse(res, 200, item)
  } catch (err) {
    next(err)
  }
}

// @desc  Update item
// @route PUT /api/v1/inventory/items/:id
const updateItem = async (req, res, next) => {
  try {
    const item = await Item.findOneAndUpdate(
      itemStoreFilter(req.user._id, { _id: req.params.id }),
      { ...req.body, storeId: req.user._id },
      { new: true, runValidators: true }
    )
    if (!item) return sendError(res, 404, 'Item not found')
    sendResponse(res, 200, item, 'Item updated')
  } catch (err) {
    next(err)
  }
}

// @desc  Soft delete item
// @route DELETE /api/v1/inventory/items/:id
const deleteItem = async (req, res, next) => {
  try {
    const item = await Item.findOneAndUpdate(
      itemStoreFilter(req.user._id, { _id: req.params.id }),
      { isDeleted: true },
      { new: true }
    )
    if (!item) return sendError(res, 404, 'Item not found')
    sendResponse(res, 200, null, 'Item removed from inventory')
  } catch (err) {
    next(err)
  }
}

// @desc  Lookup item by barcode
// @route GET /api/v1/inventory/items/barcode/:code
const getItemByBarcode = async (req, res, next) => {
  try {
    const code = req.params.code
    console.log(`📨 Barcode lookup: ${code}`)

    // 1) Exact barcode match
    let item = await Item.findOne(itemStoreFilter(req.user._id, { barcode: code, isDeleted: false }))

    // 2) Exact itemCode fallback
    if (!item) {
      item = await Item.findOne(itemStoreFilter(req.user._id, { itemCode: code, isDeleted: false }))
    }

    // 3) Case-insensitive exact match on barcode or itemCode
    if (!item) {
      item = await Item.findOne(itemStoreFilter(req.user._id, {
        $or: [
          { barcode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } },
          { itemCode: { $regex: `^${escapeRegex(code)}$`, $options: 'i' } },
        ],
        isDeleted: false,
      }))
    }

    // 4) Exact name match (some clients send name instead of barcode)
    if (!item) {
      item = await Item.findOne(itemStoreFilter(req.user._id, { name: code, isDeleted: false }))
    }

    // 5) Case-insensitive name match
    if (!item) {
      item = await Item.findOne(itemStoreFilter(req.user._id, {
        name: { $regex: `^${escapeRegex(code)}$`, $options: 'i' },
        isDeleted: false,
      }))
    }

    if (!item) {
      console.log(`🔍 No item found for barcode/code/name: ${code}`)
      return sendError(res, 404, 'Item not found for this barcode/code/name')
    }

    console.log(`🔎 Item matched by ${item.barcode === code ? 'barcode' : item.itemCode === code ? 'itemCode' : item.name === code ? 'name (exact)' : 'name (case-insensitive or fallback)'} -> ${item.itemCode}`)
    sendResponse(res, 200, item)
  } catch (err) {
    next(err)
  }
}

// @desc  Manual stock adjustment
// @route POST /api/v1/inventory/items/:id/adjust
const adjustStock = async (req, res, next) => {
  try {
    const { status, reason } = req.body
    const item = await Item.findOne(itemStoreFilter(req.user._id, { _id: req.params.id }))
    if (!item) return sendError(res, 404, 'Item not found')

    item.status = status || item.status
    await item.save()
    sendResponse(res, 200, item, `Stock adjusted: ${reason || 'Manual adjustment'}`)
  } catch (err) {
    next(err)
  }
}

// @desc  Get low stock items
// @route GET /api/v1/inventory/low-stock
const getLowStock = async (req, res, next) => {
  try {
    const lowStock = await Item.aggregate([
      { $match: { storeId: req.user._id, isDeleted: false } },
      {
        $group: {
          _id: '$category',
          count: {
            $sum: { $cond: [{ $eq: ['$status', ITEM_STATUS.IN_STOCK] }, 1, 0] },
          },
          minimumStock: { $max: '$minimumStock' },
        },
      },
      { $match: { $expr: { $lt: ['$count', '$minimumStock'] } } },
    ])
    sendResponse(res, 200, lowStock)
  } catch (err) {
    next(err)
  }
}

// @desc  Get all categories
// @route GET /api/v1/inventory/categories
const getCategories = async (req, res, next) => {
  sendResponse(res, 200, ITEM_CATEGORIES)
}

// @desc  Generate tag/barcode data for an item
// @route POST /api/v1/inventory/items/:id/tag
const generateTag = async (req, res, next) => {
  try {
    const item = await Item.findOne(itemStoreFilter(req.user._id, { _id: req.params.id }))
    if (!item) return sendError(res, 404, 'Item not found')

    const tagData = {
      itemCode: item.itemCode,
      barcode: item.barcode || item.itemCode,
      name: item.name,
      category: item.category,
      purity: item.purity,
      grossWeight: item.grossWeight,
      netWeight: item.netWeight,
      huidNumber: item.huidNumber || '',
      stoneCharge: item.stoneCharge || 0,
      makingCharge: item.makingCharge || 0,
      makingChargeFixed: item.makingChargeFixed || 0,
      wastage: item.wastage || 0,
    }

    sendResponse(res, 200, tagData, 'Tag data ready for printing')
  } catch (err) {
    next(err)
  }
}

module.exports = {
  addItem, getItems, getItemById, updateItem, deleteItem,
  getItemByBarcode, adjustStock, getLowStock, getCategories, generateTag,
}
