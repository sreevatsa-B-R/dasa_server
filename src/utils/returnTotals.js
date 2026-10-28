const roundMoney = (value) => Number(Number(value || 0).toFixed(2))

const calculateReturnTotals = (original, itemSubtotal) => {
  const returnRatio = original.subTotal > 0 ? itemSubtotal / original.subTotal : 1

  return {
    subTotal: -roundMoney(itemSubtotal),
    discount: -roundMoney(original.discount * returnRatio),
    taxableAmount: -roundMoney((original.taxableAmount || 0) * returnRatio),
    gstAmount: -roundMoney((original.gstAmount || 0) * returnRatio),
    totalAmount: -roundMoney(original.totalAmount * returnRatio),
    amountPaid: -roundMoney((original.amountPaid || 0) * returnRatio),
  }
}

module.exports = { calculateReturnTotals }
