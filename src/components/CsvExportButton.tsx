'use client'

interface Props {
  rows: Record<string, unknown>[]
  columns: string[]
  label: string
  filename: string
  className?: string
}

function escape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',')
  const lines = rows.map(r => columns.map(c => escape(r[c])).join(','))
  return [header, ...lines].join('\n')
}

export default function CsvExportButton({ rows, columns, label, filename, className }: Props) {
  function handleExport() {
    const csv = toCsv(rows, columns)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={handleExport} className={className ?? 'btn btn-sm btn-secondary'}>
      {label} ({rows.length})
    </button>
  )
}
