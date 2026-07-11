const mongoose = require('mongoose')
const dns = require('dns')

// Force Google DNS to resolve MongoDB Atlas SRV records
// (fixes querySrv ECONNREFUSED caused by local DNS blocking SRV lookups)
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    console.log(`MongoDB connected: ${conn.connection.host}`)
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
