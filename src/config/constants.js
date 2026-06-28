const KARAT_TYPES = ['18K', '14K', '22K', '24K', '92.5', '99.9', 'Silver']

const ITEM_CATEGORIES = [
  'Ring', 'Necklace', 'Bangle', 'Bracelet', 'Earring',
  'Chain', 'Pendant', 'Anklet', 'Brooch', 'Coin', 'Other'
]

const ITEM_STATUS = {
  IN_STOCK:      'in_stock',
  SOLD:          'sold',
  WITH_ARTISAN:  'with_artisan',
  RESERVED:      'reserved',
  RETURNED:      'returned',
}

const ORDER_STATUS = {
  NEW:              'new',
  SENT_TO_ARTISAN:  'sent_to_artisan',
  IN_MAKING:        'in_making',
  REWORK:           'rework',
  QUALITY_CHECK:    'quality_check',
  READY:            'ready',
  DELIVERED:        'delivered',
  CANCELLED:        'cancelled',
}

const PURCHASE_ORDER_STATUS = {
  RAISED:          'raised',
  GOLD_ISSUED:     'gold_issued',
  IN_PROGRESS:     'in_progress',
  RECEIVED:        'received',
  INVOICED:        'invoiced',
  CANCELLED:       'cancelled',
}

const PAYMENT_MODES = ['cash', 'card', 'upi', 'cheque', 'bank_transfer', 'mixed']

const USER_ROLES = {
  ADMIN:       'admin',
  MANAGER:     'manager',
  SALESPERSON: 'salesperson',
  ACCOUNTANT:  'accountant',
  VIEWER:      'viewer',
}

const JOURNAL_TYPES = {
  SALE:           'sale',
  PURCHASE:       'purchase',
  PAYMENT:        'payment',
  RECEIPT:        'receipt',
  EXPENSE:        'expense',
  ADJUSTMENT:     'adjustment',
  OLD_GOLD:       'old_gold_exchange',
}

module.exports = {
  KARAT_TYPES,
  ITEM_CATEGORIES,
  ITEM_STATUS,
  ORDER_STATUS,
  PURCHASE_ORDER_STATUS,
  PAYMENT_MODES,
  USER_ROLES,
  JOURNAL_TYPES,
}
