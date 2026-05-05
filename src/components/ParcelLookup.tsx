'use client'

import { useState, useRef, useEffect } from 'react'
import { acrestoMowMinutes, estimateMowableAcres } from '@/lib/pricing'

interface ParcelResult {
  id: string
  situs_address: string | null
  owner_name: string | null
  land_use: string | null
  source: string | null
  lot_sqft: number | null
  raw_json: { attributes?: Record<string, unknown> } | null
  source_metadata?: {
    display_name: string
    state: string
    county: string
  } | null
}

export interface ImportedParcel {
  parcelId: string | null
  parcelAcres: number | null
  mowableAcres: number | null
  mowingMinutes: number | null
  address: string
  streetAddress: string
  city: string | null
  state: string | null
  postalCode: string | null
  county: string | null
  ownerName: string | null
  landUse: string | null
  source: string | null
  lotSizeSource: string
}

interface Props {
  onImport: (data: ImportedParcel) => void
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickFirstNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = parseFloat(String(value))
    if (!Number.isNaN(n)) return n
  }
  return null
}

function parseParcelLocation(parcel: ParcelResult) {
  const rawJson = parcel.raw_json
  const attrs = rawJson?.attributes as Record<string, unknown> | undefined
  const root = rawJson as Record<string, unknown> | null

  const city = pickFirstString([
    attrs?.CityName,
    attrs?.city_name,
    attrs?.CITY_NAME,
    attrs?.city,
    attrs?.City,
    attrs?.SitusCity,
    attrs?.SITUS_CITY,
    attrs?.site_city,
    root?.CityName,
    root?.city_name,
    root?.city,
  ])

  const stateFromParcel = pickFirstString([
    attrs?.StateAbbr,
    attrs?.state_abbr,
    attrs?.STATE_ABBR,
    attrs?.state,
    attrs?.State,
    attrs?.SitusState,
    attrs?.SITUS_STATE,
    attrs?.site_state,
    root?.StateAbbr,
    root?.state_abbr,
    root?.state,
  ])
  const state = stateFromParcel ?? parcel.source_metadata?.state ?? null

  const postalCode = pickFirstString([
    attrs?.ZipCode,
    attrs?.zip_code,
    attrs?.ZIP_CODE,
    attrs?.postal_code,
    attrs?.PostalCode,
    attrs?.ZIP,
    attrs?.Zip,
    attrs?.SitusZip,
    attrs?.SITUS_ZIP,
    root?.ZipCode,
    root?.zip_code,
    root?.postal_code,
    root?.zip,
  ])

  const countyFromParcel = pickFirstString([
    attrs?.county,
    attrs?.County,
    attrs?.SitusCounty,
    attrs?.SITUS_COUNTY,
    root?.county,
  ])
  const county = countyFromParcel ?? parcel.source_metadata?.county ?? null

  return { city, state: state?.toUpperCase() ?? null, postalCode, county }
}

function computeParcel(p: ParcelResult): ImportedParcel | null {
  const address = p.situs_address ?? ''
  const location = parseParcelLocation(p)
  const attrs = p.raw_json?.attributes ?? {}
  const root = p.raw_json as Record<string, unknown> | null

  const rawParcelAcres = pickFirstNumber([
    attrs['CALC_ACRES'],
    attrs['CalcAcres'],
    attrs['calc_acres'],
    attrs['DeededAcres'],
    attrs['deeded_acres'],
    root?.CALC_ACRES,
    root?.CalcAcres,
    root?.calc_acres,
    root?.DeededAcres,
    root?.deeded_acres,
  ])
  const sqftParcelAcres = p.lot_sqft ? p.lot_sqft / 43560 : null
  const parcelAcresBase = rawParcelAcres ?? sqftParcelAcres
  const parcelAcres = parcelAcresBase != null ? Math.round(parcelAcresBase * 100) / 100 : null

  const timberAcres = pickFirstNumber([
    attrs['TimberAcres'],
    attrs['timber_acres'],
    root?.TimberAcres,
    root?.timber_acres,
  ])
  const effectiveTimber = (timberAcres != null && timberAcres > 0 && parcelAcres != null && timberAcres < parcelAcres) ? timberAcres : 0
  const mowableAcresRaw = parcelAcres != null ? estimateMowableAcres(parcelAcres, effectiveTimber, p.land_use) : null
  const mowableAcres = mowableAcresRaw != null ? Math.round(mowableAcresRaw * 100) / 100 : null
  const mowingMinutes = mowableAcres != null ? acrestoMowMinutes(mowableAcres) : null

  const streetAddress = pickFirstString([
    attrs['PhysAddr'],
    attrs['phys_addr'],
    attrs['PHYS_ADDR'],
    root?.PhysAddr,
    root?.phys_addr,
    p.situs_address,
  ]) ?? ''

  return {
    parcelId: p.id,
    parcelAcres,
    mowableAcres,
    mowingMinutes,
    address,
    streetAddress,
    city: location.city,
    state: location.state,
    postalCode: location.postalCode,
    county: location.county,
    ownerName: p.owner_name,
    landUse: p.land_use,
    source: p.source,
    lotSizeSource: 'parcel_import',
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
    if (query.length < 3) return
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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
          onChange={e => {
            const nextQuery = e.target.value
            setQuery(nextQuery)
            setImported(null)
            if (nextQuery.length < 3) {
              setResults([])
              setOpen(false)
            }
          }}
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
                        {computed.parcelAcres != null && computed.mowableAcres != null && computed.mowingMinutes != null
                          ? `${computed.parcelAcres.toFixed(2)} ac total · ~${computed.mowableAcres.toFixed(2)} mowable · ${computed.mowingMinutes} min`
                          : 'No lot size data'}
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
            {imported.address}
            {imported.parcelAcres != null && imported.mowableAcres != null && imported.mowingMinutes != null
              ? ` · ${imported.parcelAcres.toFixed(2)} ac · ~${imported.mowableAcres.toFixed(2)} mowable → ${imported.mowingMinutes} min`
              : ' · No lot size data available'}
          </span>
        </div>
      )}
    </div>
  )
}
