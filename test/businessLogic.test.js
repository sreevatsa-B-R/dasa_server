const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateReturnTotals } = require('../src/utils/returnTotals')
const { calculatePurchaseInvoiceTotals } = require('../src/utils/purchaseInvoiceTotals')
const { itemStoreFilter } = require('../src/utils/itemStoreScope')
const Item = require('../src/models/Item')

test('partial returns credit only the proportion of the original invoice', () => {
  const original = {
    subTotal: 300,
    discount: 15,
    taxableAmount: 285,
    gstAmount: 8.55,
    totalAmount: 293.55,
    amountPaid: 200,
  }

  assert.deepEqual(calculateReturnTotals(original, 100), {
    subTotal: -100,
    discount: -5,
    taxableAmount: -95,
    gstAmount: -2.85,
    totalAmount: -97.85,
    amountPaid: -66.67,
  })
})

test('purchase invoice totals convert numeric strings before addition', () => {
  assert.deepEqual(calculatePurchaseInvoiceTotals('100', '3'), {
    invoiceAmount: 100,
    gstAmount: 3,
    totalInvoiceAmt: 103,
  })
})

test('purchase invoice totals reject missing or invalid values', () => {
  assert.throws(() => calculatePurchaseInvoiceTotals(''), /Invoice amount is required/)
  assert.throws(() => calculatePurchaseInvoiceTotals('invalid', 3), /valid non-negative numbers/)
})

test('store-scoped item filters always use the authenticated store', () => {
  const filter = itemStoreFilter('store-a', { storeId: 'store-b', status: 'in_stock' })
  assert.deepEqual(filter, { storeId: 'store-a', status: 'in_stock' })
})

test('inventory items require an owning store', () => {
  assert.equal(Item.schema.path('storeId').options.required, true)
  assert.equal(Item.schema.path('storeId').options.ref, 'User')
})
