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
        doc.image(logoPath, 35, 30, { width: 65, height: 65 })
      }

      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(20).text('DASA JEWELLERS', 0, 30, { align: 'center' })
      doc.font('Helvetica').fontSize(9).fillColor('#4B5563')
      doc.text('123 Gold Street, Your City', 0, 52, { align: 'center' })
      doc.text('Phone: +91 9876543210 | GSTIN: 29AADFS6846F1ZV', 0, 64, { align: 'center' })

      // Divider Line
      doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(30, 105).lineTo(565, 105).stroke()

      // TAX INVOICE Header
      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(14).text('TAX INVOICE', 30, 115, { align: 'center' })

      // ----------------------------------------------------
      // CUSTOMER & INVOICE DETAILS SECTION
      // ----------------------------------------------------
      const name = invoice.customer?.name || invoice.customerName || 'Walk-in Customer'
      const phone = invoice.customer?.phone || invoice.customerPhone || ''
      const pan = invoice.customerPanNumber || ''
      const aadhar = invoice.customerAadharNumber || ''

      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(10).text('CUSTOMER DETAILS:', 30, 135)
      doc.font('Helvetica').fontSize(9).fillColor('#374151')
      doc.text(`Name: ${name}`, 30, 150)
      doc.text(`Mobile: ${phone}`, 30, 162)
      if (pan) doc.text(`PAN: ${pan}`, 30, 174)
      if (aadhar) doc.text(`Aadhaar: ${aadhar}`, 30, pan ? 186 : 174)

      doc.fillColor('#111827')
      doc.font('Helvetica-Bold').fontSize(10).text('INVOICE DETAILS:', 380, 135)
      doc.font('Helvetica').fontSize(9).fillColor('#374151')
      doc.text(`Bill No: ${invoice.invoiceNumber || ''}`, 380, 150)
      doc.text(`Date: ${new Date(invoice.invoiceDate || Date.now()).toLocaleDateString('en-IN')}`, 380, 162)
      doc.text(`GST Rate: ${invoice.gstRate ?? 3}%`, 380, 174)
      doc.text(`Staff: ${invoice.createdBy?.name || 'Staff'}`, 380, 186)

      // Divider Line below customer details
      const detailsBottomY = Math.max(186, pan && aadhar ? 198 : 186)
      doc.strokeColor('#D1D5DB').lineWidth(1).moveTo(30, detailsBottomY + 10).lineTo(565, detailsBottomY + 10).stroke()

      // ----------------------------------------------------
      // ITEMS TABLE SECTION
      // ----------------------------------------------------
      const tableTopY = detailsBottomY + 25
      const colWidths = {
        sl: 20,
        item: 100,
        hsn: 30,
        qty: 20,
        purity: 30,
        gross: 35,
        stoneWt: 35,
        net: 35,
        waste: 30,
        rate: 40,
        making: 45,
        stoneVal: 50,
        total: 65
      }

      const colPositions = {}
      let currentX = 30
      for (const [col, width] of Object.entries(colWidths)) {
        colPositions[col] = currentX
        currentX += width
      }

      // Draw Table Header Background
      doc.fillColor('#F9FAFB')
      doc.rect(30, tableTopY, 535, 20).fill()

      doc.fillColor('#374151')
      doc.font('Helvetica-Bold').fontSize(8)
      
      doc.text('Sl', colPositions.sl + 2, tableTopY + 6)
      doc.text('Item', colPositions.item + 2, tableTopY + 6)
      doc.text('HSN', colPositions.hsn + 2, tableTopY + 6)
      doc.text('Qty', colPositions.qty + 2, tableTopY + 6)
      doc.text('Purity', colPositions.purity + 2, tableTopY + 6)
      doc.text('Gross', colPositions.gross + 2, tableTopY + 6)
      doc.text('Stone', colPositions.stoneWt + 2, tableTopY + 6)
      doc.text('Net', colPositions.net + 2, tableTopY + 6)
      doc.text('Waste', colPositions.waste + 2, tableTopY + 6)
      doc.text('Rate', colPositions.rate + 2, tableTopY + 6)
      doc.text('Making', colPositions.making + 2, tableTopY + 6)
      doc.text('Stone Val', colPositions.stoneVal + 2, tableTopY + 6)
      doc.text('Total', colPositions.total + 2, tableTopY + 6)

      // Draw Table Rows Content
      doc.font('Helvetica').fontSize(8)
      doc.fillColor('#4B5563')
      let currentY = tableTopY + 20

      const items = invoice.items || []
      items.forEach((item, idx) => {
        doc.text(String(idx + 1), colPositions.sl + 2, currentY + 6)
        doc.text(item.itemName || item.name || 'Item', colPositions.item + 2, currentY + 6, { width: colWidths.item - 4, height: 14 })
        doc.text(item.hsnCode || '711319', colPositions.hsn + 2, currentY + 6)
        doc.text('1', colPositions.qty + 2, currentY + 6)
        doc.text(item.purity || '', colPositions.purity + 2, currentY + 6)
        doc.text(item.grossWeight ? `${item.grossWeight}g` : '0g', colPositions.gross + 2, currentY + 6)
        doc.text(item.stoneWeight ? `${item.stoneWeight}g` : '0g', colPositions.stoneWt + 2, currentY + 6)
        doc.text(item.netWeight ? `${item.netWeight}g` : '0g', colPositions.net + 2, currentY + 6)
        doc.text(item.wastage ? `${item.wastage}g` : '0g', colPositions.waste + 2, currentY + 6)
        doc.text(item.goldRateUsed ? String(item.goldRateUsed.toFixed(0)) : '0', colPositions.rate + 2, currentY + 6)
        doc.text(item.makingCharge ? `${item.makingCharge}` : '0', colPositions.making + 2, currentY + 6)
        doc.text(item.stoneCharge ? String(item.stoneCharge) : '0', colPositions.stoneVal + 2, currentY + 6)
        doc.text(money(item.subTotal), colPositions.total + 2, currentY + 6)

        currentY += 20
      })

      // Draw Table Borders (Grid Style)
      const tableBottomY = tableTopY + 20 + (items.length * 20)
      doc.strokeColor('#D1D5DB').lineWidth(0.5)
      
      // Draw outer box
      doc.rect(30, tableTopY, 535, 20 + (items.length * 20)).stroke()
      
      // Draw horizontal divider for header
      doc.moveTo(30, tableTopY + 20).lineTo(565, tableTopY + 20).stroke()
      
      // Draw horizontal divider for each row
      for (let i = 0; i < items.length; i++) {
        const y = tableTopY + 20 + (i + 1) * 20
        doc.moveTo(30, y).lineTo(565, y).stroke()
      }

      // Draw vertical divider lines
      const verticalLinesX = [50, 150, 180, 200, 230, 265, 300, 335, 365, 405, 450, 500]
      verticalLinesX.forEach(x => {
        doc.moveTo(x, tableTopY).lineTo(x, tableBottomY).stroke()
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
      if (invoice.oldGoldTaxableValue > 0) {
        drawSummaryRow('Old Gold Deduct:', '-' + formatCurrency(invoice.oldGoldTaxableValue))
      }
      drawSummaryRow('Taxable Value:', formatCurrency(invoice.taxableAmount))
      
      const cgstSgstAmt = Number(invoice.gstAmount || 0) / 2
      drawSummaryRow('CGST @ 1.5%:', formatCurrency(cgstSgstAmt))
      drawSummaryRow('SGST @ 1.5%:', formatCurrency(cgstSgstAmt))

      if (invoice.discount > 0) {
        drawSummaryRow('Discount:', '-' + formatCurrency(invoice.discount))
      }
      
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