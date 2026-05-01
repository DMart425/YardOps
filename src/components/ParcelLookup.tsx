'use client'

import { useState, useRef, useEffect } from 'react'
import { acrestoMowMinutes, estimateMowableAcres } from '@/lib/pricing'

interface ParcelResult {
  id: string
  situs_address: string | null
  owner_name: string | null
  land_use: string | null
  lot_sqft: number | null
  raw_json: { attributes?: Record<string, unknown> } | null
}

interface ImportedParcel {
  parcelAcres: number
  mowableAcres: number
  mowingMinutes: number
  address: string
  ownerName: string | null
  landUse: string | null
}

interface Props {
  onImport: (data: ImportedParcel) => void
}

function computeParcel(p: ParcelResult): ImportedParcel | null {
  if (!p.lot_sqft) return null
  const parcelAcres = p.lot_sqft / 43560
  const attrs = p.raw_json?.attributes ?? {}
  const toNum = (v: unknown) => { const n = parseFloat(String(v)); return !isNaN(n) ? n : null }
  const timberAcres = toNum(attrs['TimberAcres'])
  const effectiveTimber = (timberAcres != null && timberAcres > 0 && timberAcres < parcelAcres) ? timberAcres : 0
  const mowableAcres = estimateMowableAcres(parcelAcres, effectiveTimber, p.land_use)
  const mowingMinutes = acrestoMowMinutes(mowableAcres)
  return {
    parcelAcres: Math.round(parcelAcres * 1000) / 1000,
    mowableAcres,
    mowingMinutes,
    address: p.situs_address ?? '',
    ownerName: p.owner_name,
    landUse: p.land_use,
  }
}

export default function ParcelLookup({ onImport }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ParcelResult[]>([])
  const [loading, setLoading] = useState(false)
  const [imported, setImported] = useState<ImportedParcel | null>(null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 3) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/parcels/search?q=' + encodeURIComponent(query))
        const data = await res.json()
        setResults(data)
        setOpen(data.length > 0)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleSelect(p: ParcelResult) {
    const data = computeParcel(p)
    if (!data) return
    setImported(data)
    setOpen(false)
    setQuery('')
    onImport(data)
  }

  return (
    <div ref={containerRef} style={{ marginBottom: '4px' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by street address (e.g. 123 Oak St)"
          value={query}
          onChange={e => { setQuery(e.target.value); setImported(null) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
            searching…
          </span>
        )}
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--r-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            {results.map(p => {
              const computed = computeParcel(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 12px', background: 'none', border: 'none',
                    borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                    color: 'var(--color-text)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.situs_address ?? '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted, #9ca3af)', marginTop: '2px' }}>
                    {p.owner_name && <span>{p.owner_name} · </span>}
                    {p.land_use && <span>{p.land_use} · </span>}
                    {computed ? (
                      <span style={{ color: 'var(--color-primary)' }}>
                        {computed.parcelAcres.toFixed(3)} ac total · ~{computed.mowableAcres.toFixed(2)} mowable · {computed.mowingMinutes} min
                      </span>
                    ) : (
                      <span>No lot size data</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {imported && (
        <div style={{
          marginTop: '8px', padding: '10px 12px',
          background: 'rgba(22,163,74,0.08)', border: '1px solid var(--color-primary)',
          borderRadius: 'var(--r-sm)', fontSize: '0.8125rem',
        }}>
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>✓ Parcel imported</span>
          <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>
            {imported.address} · {imported.parcelAcres.toFixed(3)} ac · ~{imported.mowableAcres.toFixed(2)} mowable → {imported.mowingMinutes} min
          </span>
        </div>
      )}
    </div>
  )
}
