const { USER_ROLES } = require('../config/constants')

// Usage: authorize('admin', 'manager')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      })
    }
    next()
  }
}

// Shorthand role groups
const isAdmin       = authorize(USER_ROLES.ADMIN)
const isAdminOrManager    = authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER)
const isAdminOrAccountant = authorize(USER_ROLES.ADMIN, USER_ROLES.ACCOUNTANT)
const notViewer     = authorize(USER_ROLES.ADMIN, USER_ROLES.MANAGER, USER_ROLES.SALESPERSON, USER_ROLES.ACCOUNTANT)

module.exports = { authorize, isAdmin, isAdminOrManager, isAdminOrAccountant, notViewer }
