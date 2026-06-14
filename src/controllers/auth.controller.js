const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { sendResponse, sendError } = require('../utils/response')

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' })
}

// @desc  Login user
// @route POST /api/v1/auth/login
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return sendError(res, 400, 'Please provide phone and password')
    }

    const user = await User.findOne({ phone }).select('+password')
    if (!user || !(await user.matchPassword(password))) {
      return sendError(res, 401, 'Invalid credentials')
    }

    if (!user.isActive) {
      return sendError(res, 401, 'Account is deactivated')
    }

    const token = generateToken(user._id)
    sendResponse(res, 200, {
      token,
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
    }, 'Login successful')
  } catch (err) {
    next(err)
  }
}

// @desc  Logout (client-side token removal; placeholder for token blacklist)
// @route POST /api/v1/auth/logout
const logout = (req, res) => {
  sendResponse(res, 200, null, 'Logged out successfully')
}

// @desc  Get current logged-in user
// @route GET /api/v1/auth/me
const getMe = async (req, res, next) => {
  try {
    sendResponse(res, 200, req.user)
  } catch (err) {
    next(err)
  }
}

// @desc  Create new user
// @route POST /api/v1/auth/users
const createUser = async (req, res, next) => {
  try {
    const { name, phone, password, role } = req.body
    const user = await User.create({ name, phone, password, role })
    sendResponse(res, 201, { id: user._id, name: user.name, phone: user.phone, role: user.role }, 'User created')
  } catch (err) {
    next(err)
  }
}

// @desc  Update user
// @route PUT /api/v1/auth/users/:id
const updateUser = async (req, res, next) => {
  try {
    const { name, role, isActive, password } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return sendError(res, 404, 'User not found')

    if (name) user.name = name
    if (role) user.role = role
    if (isActive !== undefined) user.isActive = isActive
    if (password) user.password = password  // will be hashed by pre-save hook

    await user.save()
    sendResponse(res, 200, { id: user._id, name: user.name, role: user.role, isActive: user.isActive }, 'User updated')
  } catch (err) {
    next(err)
  }
}

// @desc  Get all users
// @route GET /api/v1/auth/users
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    sendResponse(res, 200, users)
  } catch (err) {
    next(err)
  }
}

module.exports = { login, logout, getMe, createUser, updateUser, getAllUsers }
