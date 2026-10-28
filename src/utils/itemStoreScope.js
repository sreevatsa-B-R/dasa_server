const itemStoreFilter = (storeId, filters = {}) => ({
  ...filters,
  storeId,
})

module.exports = { itemStoreFilter }
