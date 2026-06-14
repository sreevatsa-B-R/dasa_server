const express = require('express')
const router  = express.Router()
const { protect }      = require('../middleware/auth')
const { notViewer }    = require('../middleware/role')
const {
  createEstimation,
  getEstimations,
  getEstimation,
  updateEstimationStatus,
} = require('../controllers/estimation.controller')

// POST   /api/v1/estimations        — Create new estimation
// GET    /api/v1/estimations        — List all estimations
router.route('/')
  .post(protect, notViewer, createEstimation)
  .get(protect, getEstimations)

// GET    /api/v1/estimations/:id    — Get single estimation (for reprint)
router.get('/:id', protect, getEstimation)

// PATCH  /api/v1/estimations/:id/status  — Update status (active/expired/converted)
router.patch('/:id/status', protect, notViewer, updateEstimationStatus)

module.exports = router
