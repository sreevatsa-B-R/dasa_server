const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { isAdmin } = require('../middleware/role')
const {
  login, logout, getMe,
  createUser, updateUser, getAllUsers,
} = require('../controllers/auth.controller')

router.post('/login', login)
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)

router.route('/users')
  .get(protect, isAdmin, getAllUsers)
  .post(protect, isAdmin, createUser)

router.put('/users/:id', protect, isAdmin, updateUser)

module.exports = router
