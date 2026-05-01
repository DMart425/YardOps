'use client'

import { useRouter } from 'next/navigation'

interface CsvRow {
  date: string
  type: 'income' | 'expense'
  customer_or_vendor: string
  description: string
  category: string
  amount: number
}

interface Props {
  rows: CsvRow[]
  label: string
  filename: string
}

function toCsv(rows: CsvRow[]): string {
  const header = 'date,type,customer_or_vendor,description,category,amount'
  const lines = rows.map(r =>
    [
      r.date,
      r.type,
      `"${(r.customer_or_vendor ?? '').replace(/"/g, '""')}"`,
      `"${(r.description ?? '').replace(/"/g, '""')}"`,
      r.category,
      r.amount.toFixed(2),
    ].join(',')
  )
  return [header, ...lines].join('\n')
}

export default function FinancesExportButton({ rows, label, filename }: Props) {
  function handleExport() {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={handleExport} className="btn btn-secondary btn-sm">
      {label}
    </button>
  )
}
