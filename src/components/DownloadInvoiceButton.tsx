'use client'

import jsPDF from 'jspdf'

interface InvoiceData {
  businessName: string
  businessPhone: string | null
  businessEmail: string | null
  customerName: string
  customerPhone: string | null
  customerEmail: string | null
  serviceAddress: string
  jobTitle: string
  jobDate: string | null  // completed_at or scheduled_date
  servicePackage: string | null
  price: number
  amountPaid: number
  paymentStatus: string
  paymentMethod: string | null
  notes: string | null
  venmoHandle: string | null
  invoiceNumber: string  // job id (short form)
}

export function DownloadInvoiceButton({ data }: { data: InvoiceData }) {
  function generatePdf() {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 50
    let y = margin

    // Header — business name
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(data.businessName || 'Invoice', margin, y)
    y += 24
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (data.businessPhone) { doc.text(data.businessPhone, margin, y); y += 14 }
    if (data.businessEmail) { doc.text(data.businessEmail, margin, y); y += 14 }

    // Invoice label (top right)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('INVOICE', pageWidth - margin, margin, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`#${data.invoiceNumber}`, pageWidth - margin, margin + 18, { align: 'right' })
    doc.text(`Date: ${new Date().toLocaleDateString('en-US')}`, pageWidth - margin, margin + 32, { align: 'right' })
    if (data.jobDate) {
      const fmt = new Date(data.jobDate).toLocaleDateString('en-US')
      doc.text(`Service date: ${fmt}`, pageWidth - margin, margin + 46, { align: 'right' })
    }

    y = Math.max(y, margin + 70)
    y += 20

    // Bill To
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Bill To:', margin, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(data.customerName, margin, y); y += 14
    doc.text(data.serviceAddress, margin, y); y += 14
    if (data.customerPhone) { doc.text(data.customerPhone, margin, y); y += 14 }
    if (data.customerEmail) { doc.text(data.customerEmail, margin, y); y += 14 }

    y += 16

    // Service line table
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    y += 16
    doc.setFont('helvetica', 'bold')
    doc.text('Description', margin, y)
    doc.text('Amount', pageWidth - margin, y, { align: 'right' })
    y += 12
    doc.line(margin, y, pageWidth - margin, y)
    y += 16

    doc.setFont('helvetica', 'normal')
    const desc = data.servicePackage
      ? `${data.jobTitle} (${data.servicePackage.replace(/_/g, ' ')})`
      : data.jobTitle
    doc.text(desc, margin, y)
    doc.text(`$${data.price.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
    y += 24

    // Totals
    doc.line(margin, y, pageWidth - margin, y)
    y += 16
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', pageWidth - margin - 80, y)
    doc.text(`$${data.price.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.text('Paid:', pageWidth - margin - 80, y)
    doc.text(`$${data.amountPaid.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
    y += 16

    const balance = data.price - data.amountPaid
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Balance Due:', pageWidth - margin - 80, y)
    doc.text(`$${balance.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })
    doc.setFontSize(10)
    y += 24

    // Status banner
    if (data.paymentStatus === 'paid' || balance <= 0) {
      doc.setFillColor(220, 252, 231)
      doc.setTextColor(22, 101, 52)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 4, 4, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text('PAID — Thank you!', pageWidth / 2, y + 18, { align: 'center' })
      doc.setTextColor(0)
      y += 40
    } else if (data.venmoHandle) {
      doc.setFillColor(239, 246, 255)
      doc.setTextColor(30, 58, 138)
      doc.roundedRect(margin, y, pageWidth - 2 * margin, 50, 4, 4, 'F')
      doc.setFont('helvetica', 'bold')
      doc.text('Pay via Venmo', pageWidth / 2, y + 18, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.text(`@${data.venmoHandle}`, pageWidth / 2, y + 34, { align: 'center' })
      doc.text(`venmo.com/${data.venmoHandle}`, pageWidth / 2, y + 46, { align: 'center' })
      doc.setTextColor(0)
      y += 62
    }

    // Notes
    if (data.notes) {
      doc.setFont('helvetica', 'bold')
      doc.text('Notes:', margin, y)
      y += 14
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
      doc.text(lines, margin, y)
      y += lines.length * 12
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - margin
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' })

    const safeName = (data.customerName || 'invoice').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    doc.save(`invoice-${safeName}-${data.invoiceNumber}.pdf`)
  }

  return (
    <button type="button" onClick={generatePdf} className="btn btn-sm btn-secondary">
      📄 Download Invoice PDF
    </button>
  )
}
