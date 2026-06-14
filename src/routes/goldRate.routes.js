const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdminOrManager } = require('../middleware/role')
const {
  setGoldRate, getTodayRate, getRateHistory, getRateByDate,
} = require('../controllers/goldRate.controller')

router.post('/',       protect, isAdminOrManager, setGoldRate)
router.get('/today',   protect, getTodayRate)
router.get('/',        protect, isAdminOrManager, getRateHistory)
router.get('/:date',   protect, getRateByDate)

module.exports = router
