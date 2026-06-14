const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

const money = (value) => Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatCurrency = (val) => {
  return '₹' + money(val)
}

const generateInvoiceFile = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 30 })
      const buffers = []

      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err) => reject(err))

      // Draw outer border
      doc.strokeColor('#374151').lineWidth(1.5).rect(20, 20, 555, 802).stroke()

      // ----------------------------------------------------
      // HEADER SECTION (Logo & Title)
      // ----------------------------------------------------
      const logoPath = path.join(__dirname, '../../../Frontend/public/logo.png')
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 35, 30, { width: 75, height: 75 })
      }

      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(22).text('TAX INVOICE', 0, 30, { align: 'center' })
      doc.fontSize(8).font('Helvetica').text('GSTIN: 29AADFS6846F1ZV', 0, 55, { align: 'center' })

      // Right-aligned Metadata
      doc.fillColor('#374151')
      doc.font('Helvetica-Bold').fontSize(9)
      doc.text('Bill No:', 410, 30)
      doc.font('Helvetica').text(invoice.invoiceNumber || '', 475, 30, { align: 'right', width: 90 })

      doc.font('Helvetica-Bold').text('Date:', 410, 42)
      doc.font('Helvetica').text(new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN'), 475, 42, { align: 'right', width: 90 })

      doc.font('Helvetica-Bold').text('GST Rate:', 410, 54)
      doc.font('Helvetica').text(`${invoice.gstRate ?? 3}%`, 475, 54, { align: 'right', width: 90 })

      doc.font('Helvetica-Bold').text('Staff:', 410, 66)
      doc.font('Helvetica').text(invoice.createdBy?.name || 'Staff', 475, 66, { align: 'right', width: 90 })

      // Divider Line
      doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(30, 105).lineTo(565, 105).stroke()

      // ----------------------------------------------------
      // CUSTOMER DETAILS SECTION
      // ----------------------------------------------------
      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(10).text('CUSTOMER DETAILS:', 30, 115)
      
      doc.font('Helvetica').fontSize(9)
      const name = invoice.customer?.name || invoice.customerName || 'Walk-in Customer'
      const phone = invoice.customer?.phone || invoice.customerPhone || ''
      const pan = invoice.customerPanNumber || ''
      const aadhar = invoice.customerAadharNumber || ''

      doc.text(`Name: ${name}`, 30, 130)
      doc.text(`Mobile: ${phone}`, 30, 142)
      if (pan) doc.text(`PAN: ${pan}`, 30, 154)
      if (aadhar) doc.text(`Aadhaar: ${aadhar}`, 30, pan ? 166 : 154)

      // Store Details (Bill From)
      doc.font('Helvetica-Bold').text('BILL FROM:', 380, 115)
      doc.font('Helvetica')
      doc.text('Dasa Jewellery', 380, 130)
      doc.text('Jewellery Billing System', 380, 142)
      doc.text('India', 380, 154)

      // Divider Line
      const detailsBottomY = Math.max(166, pan && aadhar ? 178 : 166)
      doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(30, detailsBottomY + 10).lineTo(565, detailsBottomY + 10).stroke()

      // ----------------------------------------------------
      // ITEMS TABLE SECTION
      // ----------------------------------------------------
      const tableTopY = detailsBottomY + 25
      const colWidths = {
        sl: 20,
        item: 105,
        hsn: 35,
        purity: 30,
        gross: 35,
        stoneWt: 35,
        net: 35,
        waste: 30,
        rate: 45,
        making: 45,
        stoneVal: 35,
        qty: 20,
        total: 65
      }

      const colPositions = {}
      let currentX = 30
      for (const [col, width] of Object.entries(colWidths)) {
        colPositions[col] = currentX
        currentX += width
      }

      // Draw Table Header
      doc.fillColor('#F9FAFB')
      doc.rect(30, tableTopY, 535, 20).fill()
      doc.strokeColor('#E5E7EB').lineWidth(0.5).rect(30, tableTopY, 535, 20).stroke()

      doc.fillColor('#374151')
      doc.font('Helvetica-Bold').fontSize(8)
      
      doc.text('Sl', colPositions.sl + 2, tableTopY + 6)
      doc.text('Item', colPositions.item + 2, tableTopY + 6)
      doc.text('HSN', colPositions.hsn + 2, tableTopY + 6)
      doc.text('Purity', colPositions.purity + 2, tableTopY + 6)
      doc.text('Gross', colPositions.gross + 2, tableTopY + 6)
      doc.text('Stone', colPositions.stoneWt + 2, tableTopY + 6)
      doc.text('Net', colPositions.net + 2, tableTopY + 6)
      doc.text('Waste', colPositions.waste + 2, tableTopY + 6)
      doc.text('Rate', colPositions.rate + 2, tableTopY + 6)
      doc.text('Making', colPositions.making + 2, tableTopY + 6)
      doc.text('Stone Val', colPositions.stoneVal + 2, tableTopY + 6)
      doc.text('Qty', colPositions.qty + 2, tableTopY + 6)
      doc.text('Total', colPositions.total + 2, tableTopY + 6)

      // Draw Table Rows
      doc.font('Helvetica').fontSize(8)
      doc.fillColor('#4B5563')
      let currentY = tableTopY + 20

      const items = invoice.items || []
      items.forEach((item, idx) => {
        // Draw vertical borders
        doc.strokeColor('#E5E7EB').lineWidth(0.5)
        doc.rect(30, currentY, 535, 20).stroke()

        doc.text(String(idx + 1), colPositions.sl + 2, currentY + 6)
        doc.text(item.itemName || item.name || 'Item', colPositions.item + 2, currentY + 6, { width: colWidths.item - 4, height: 14 })
        doc.text(item.hsnCode || '711319', colPositions.hsn + 2, currentY + 6)
        doc.text(item.purity || '', colPositions.purity + 2, currentY + 6)
        doc.text(item.grossWeight ? `${item.grossWeight}g` : '0g', colPositions.gross + 2, currentY + 6)
        doc.text(item.stoneWeight ? `${item.stoneWeight}g` : '0g', colPositions.stoneWt + 2, currentY + 6)
        doc.text(item.netWeight ? `${item.netWeight}g` : '0g', colPositions.net + 2, currentY + 6)
        doc.text(item.wastage ? `${item.wastage}g` : '0g', colPositions.waste + 2, currentY + 6)
        doc.text(item.goldRateUsed ? String(item.goldRateUsed.toFixed(0)) : '0', colPositions.rate + 2, currentY + 6)
        doc.text(item.makingCharge ? `${item.makingCharge}` : '0', colPositions.making + 2, currentY + 6)
        doc.text(item.stoneCharge ? String(item.stoneCharge) : '0', colPositions.stoneVal + 2, currentY + 6)
        doc.text('1', colPositions.qty + 2, currentY + 6)
        doc.text(money(item.subTotal), colPositions.total + 2, currentY + 6)

        currentY += 20
      })
      // DEDUCTIONS & SUMMARY SECTION
      // ----------------------------------------------------
      currentY += 15

      // Left Column details (Notes, Payments, Old Gold)
      let leftY = currentY
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
      
      if (invoice.oldGoldWeight > 0) {
        doc.text('OLD GOLD EXCHANGE:', 30, leftY)
        doc.font('Helvetica').fontSize(8).fillColor('#4B5563')
        leftY += 12
        doc.text(`Weight: ${invoice.oldGoldWeight}g | Purity: ${invoice.oldGoldPurity || 'N/A'}`, 30, leftY)
        leftY += 10
        doc.text(`Rate: ₹${invoice.oldGoldPricePerGram || invoice.oldGoldRate}/g | Value: ${formatCurrency(invoice.oldGoldTaxableValue)}`, 30, leftY)
        leftY += 15
      }

      if (invoice.payments && invoice.payments.length > 0) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('PAYMENT DETAILS:', 30, leftY)
        doc.font('Helvetica').fontSize(8).fillColor('#4B5563')
        leftY += 12
        invoice.payments.forEach((p) => {
          doc.text(`${String(p.mode).toUpperCase()}: ${formatCurrency(p.amount)}${p.reference ? ` (Ref: ${p.reference})` : ''}`, 30, leftY)
          leftY += 10
        })
        leftY += 5
      }

      if (invoice.notes) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('NOTE:', 30, leftY)
        doc.font('Helvetica').fontSize(8).fillColor('#4B5563')
        leftY += 12
        doc.text(invoice.notes, 30, leftY, { width: 250 })
      }

      // Right Column details (Totals Box)
      let rightY = currentY
      const summaryLabelX = 360
      const summaryValueX = 470
      
      const drawSummaryRow = (label, val, isBold = false) => {
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#374151')
        doc.text(label, summaryLabelX, rightY)
        doc.text(val, summaryValueX, rightY, { align: 'right', width: 95 })
        rightY += 16
      }

      drawSummaryRow('Sub Total:', formatCurrency(invoice.subTotal))
      if (invoice.discount > 0) {
        drawSummaryRow('Discount:', '-' + formatCurrency(invoice.discount))
      }
      if (invoice.oldGoldTaxableValue > 0) {
        drawSummaryRow('Old Gold Deduct:', '-' + formatCurrency(invoice.oldGoldTaxableValue))
      }
      drawSummaryRow('Taxable Value:', formatCurrency(invoice.taxableAmount))
      
      const cgstSgstAmt = Number(invoice.gstAmount || 0) / 2
      drawSummaryRow('CGST @ 1.5%:', formatCurrency(cgstSgstAmt))
      drawSummaryRow('SGST @ 1.5%:', formatCurrency(cgstSgstAmt))
      
      doc.strokeColor('#D1D5DB').lineWidth(0.5).moveTo(360, rightY).lineTo(565, rightY).stroke()
      rightY += 6
      drawSummaryRow('Total Amount:', formatCurrency(invoice.totalAmount), true)
      drawSummaryRow('Amount Paid:', formatCurrency(invoice.amountPaid))
      drawSummaryRow('Balance Due:', formatCurrency(invoice.balanceDue), true)

      // ----------------------------------------------------
      // SIGNATURES SECTION
      // ----------------------------------------------------
      const finalY = Math.max(leftY, rightY) + 40
      
      doc.strokeColor('#9CA3AF').lineWidth(0.5)
      
      // Customer signature line
      doc.moveTo(30, finalY).lineTo(180, finalY).stroke()
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563')
      doc.text('Customer Signature', 30, finalY + 5)

      // Seller signature line
      doc.moveTo(415, finalY).lineTo(565, finalY).stroke()
      doc.text('Authorized Signatory', 415, finalY + 5)

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  generateInvoiceFile,
}