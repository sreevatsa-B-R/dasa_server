const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const errorHandler = require('./middleware/errorHandler')

const app = express()

// ── Security & logging middleware ──────────────────────────
app.use(helmet())
app.use(cors())
app.use(morgan('dev'))

// Custom request logging
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`)
  next()
})

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── Routes ─────────────────────────────────────────────────
app.use('/api/v1/auth',        require('./routes/auth.routes'))
app.use('/api/v1/gold-rates',  require('./routes/goldRate.routes'))
app.use('/api/v1/inventory',   require('./routes/inventory.routes'))
app.use('/api/v1/sales',       require('./routes/sales.routes'))
app.use('/api/v1/orders',      require('./routes/orders.routes'))
app.use('/api/v1/purchase',    require('./routes/purchase.routes'))
app.use('/api/v1/accounting',  require('./routes/accounting.routes'))
app.use('/api/v1/customers',    require('./routes/customers.routes'))
app.use('/api/v1/artisans',     require('./routes/artisans.routes'))
app.use('/api/v1/reports',      require('./routes/reports.routes'))
app.use('/api/v1/estimations',  require('./routes/estimation.routes'))

// ── Health check ───────────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'Gold ERP API is running' })
})

// ── 404 handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// ── Global error handler ───────────────────────────────────
app.use(errorHandler)

module.exports = app
