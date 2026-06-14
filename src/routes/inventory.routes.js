const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdmin, isAdminOrManager, notViewer } = require('../middleware/role')
const {
  addItem, getItems, getItemById, updateItem, deleteItem,
  getItemByBarcode, adjustStock, getLowStock, getCategories, generateTag,
} = require('../controllers/inventory.controller')

router.route('/items')
  .post(protect, notViewer, addItem)
  .get(protect, getItems)

router.get('/items/barcode/:code', protect, getItemByBarcode)
router.get('/low-stock',           protect, isAdminOrManager, getLowStock)
router.get('/categories',          protect, getCategories)

router.route('/items/:id')
  .get(protect, getItemById)
  .put(protect, isAdminOrManager, updateItem)
  .delete(protect, isAdmin, deleteItem)

router.post('/items/:id/adjust', protect, isAdminOrManager, adjustStock)
router.post('/items/:id/tag',    protect, notViewer, generateTag)

module.exports = router
