const sendResponse = (res, statusCode, data = null, message = 'Success') => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

const sendError = (res, statusCode, message) => {
  res.status(statusCode).json({
    success: false,
    message,
  })
}

const paginate = (query, page = 1, limit = 20) => {
  const skip = (page - 1) * limit
  return query.skip(skip).limit(limit)
}

module.exports = { sendResponse, sendError, paginate }
