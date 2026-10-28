const calculatePurchaseInvoiceTotals = (invoiceAmount, gstAmount = 0) => {
  if (invoiceAmount === undefined || invoiceAmount === null || invoiceAmount === '') {
    throw new RangeError('Invoice amount is required')
  }

  const invoiceAmountNumber = Number(invoiceAmount)
  const gstAmountNumber = Number(gstAmount ?? 0)
  if (!Number.isFinite(invoiceAmountNumber) || invoiceAmountNumber < 0 ||
      !Number.isFinite(gstAmountNumber) || gstAmountNumber < 0) {
    throw new RangeError('Invoice and GST amounts must be valid non-negative numbers')
  }

  return {
    invoiceAmount: invoiceAmountNumber,
    gstAmount: gstAmountNumber,
    totalInvoiceAmt: invoiceAmountNumber + gstAmountNumber,
  }
}

module.exports = { calculatePurchaseInvoiceTotals }
