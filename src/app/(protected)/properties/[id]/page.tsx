import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Property } from '@/types/database'
import { PropertyForm } from '@/components/forms/PropertyForm'
import { updateProperty } from '../actions'
import { ApplyParcelButton } from '@/app/(protected)/leads/[id]/ApplyParcelButton'
import { estimateMowableAcres } from '@/lib/pricing'
import { PropertyDangerZone } from './PropertyDangerZone'
import { PropertyAssignmentSection } from './PropertyAssignmentSection'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: property }, { data: customers }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase
      .from('customers')
      .select('id, first_name, last_name, status')
      .neq('status', 'archived')
      .order('first_name'),
  ])

  if (!property) notFound()

  // Revenue stats for this property
  const { data: propJobs } = await supabase
    .from('jobs')
    .select('id, status, price, amount_paid, payment_status, completed_at')
    .eq('property_id', id)

  const completedPropJobs = (propJobs ?? []).filter(j => j.status === 'completed')
  const propRevenue  = completedPropJobs.reduce((s, j) => s + Number(j.price ?? 0), 0)
  const propUnpaid   = completedPropJobs
    .filter(j => j.payment_status !== 'paid')
    .reduce((s, j) => s + Math.max(0, Number(j.price ?? 0) - Number(j.amount_paid ?? 0)), 0)
  const lastPropVisit = completedPropJobs
    .map(j => j.completed_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop()

  const p = property as Property
  const { data: currentCustomerData } = await supabase
    .from('customers')
    .select('id, first_name, last_name, status')
    .eq('id', p.customer_id)
    .maybeSingle()
  const currentCustomer = currentCustomerData ?? (customers ?? []).find(c => c.id === p.customer_id) ?? null
  const currentCustomerName = currentCustomer
    ? `${currentCustomer.first_name}${currentCustomer.last_name ? ` ${currentCustomer.last_name}` : ''}`
    : 'Unknown customer'

  // Parcel lookup
  type ParcelRow = {
    id: string
    situs_address: string
    lot_sqft: number | null
    owner_name: string | null
    land_use: string | null
    lat: number | null
    lon: number | null
    raw_json: { attributes?: Record<string, unknown> } | null
  }
  let parcel: ParcelRow | null = null
  if (p.service_address) {
    const searchTerm = p.service_address.split(',')[0].trim()
    const { data: parcelMatch } = await supabase
      .from('parcels')
      .select('id, situs_address, lot_sqft, owner_name, land_use, lat, lon, raw_json')
      .ilike('situs_address', `%${searchTerm}%`)
      .limit(1)
      .single()
    parcel = (parcelMatch as ParcelRow) ?? null
  }
  const pAttrs = parcel?.raw_json?.attributes ?? {}
  const toNum = (v: unknown) => { const n = parseFloat(String(v)); return (v != null && v !== '' && !isNaN(n)) ? n : null }
  const parcelAcres     = parcel?.lot_sqft ? parcel.lot_sqft / 43560 : null
  const timberAcres     = toNum(pAttrs['TimberAcres'])
  const effectiveTimber = (timberAcres != null && timberAcres > 0 && parcelAcres != null && timberAcres < parcelAcres) ? timberAcres : 0
  const mowableAcres    = parcelAcres != null && parcel ? estimateMowableAcres(parcelAcres, effectiveTimber, parcel.land_use) : null
  const subdivision     = pAttrs['SubDivision'] as string | null | undefined
  const homesteadCode   = pAttrs['HomesteadCode'] as string | null | undefined
  const salePrice       = toNum(pAttrs['SalePrice'])
  const deedDateMs      = toNum(pAttrs['DeedDate'])
  const deedDate        = deedDateMs ? new Date(deedDateMs) : null
  const totalMktValue   = toNum(pAttrs['TotalMktValue'])
  const alreadyApplied  = !!p.parcel_id && p.parcel_id === parcel?.id

  const warnings = [
    p.pet_warning ? `🐕 ${p.pet_warning}` : null,
    p.gate_code ? `🔒 Gate: ${p.gate_code}` : null,
    p.access_notes ? `🚪 ${p.access_notes}` : null,
    p.obstacle_notes ? `⚠ ${p.obstacle_notes}` : null,
    p.parking_notes ? `🚛 ${p.parking_notes}` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="page">
      <Link href="/properties" className="back-link">← Properties</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{p.property_name ?? p.service_address}</h1>
          <span className={`pill pill-${p.status}`}>{p.status}</span>
        </div>
      </div>

      {/* Revenue stats */}
      {completedPropJobs.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-value">{completedPropJobs.length}</div>
            <div className="stat-label">Jobs done</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">${propRevenue.toFixed(0)}</div>
            <div className="stat-label">Total revenue</div>
          </div>
          {propUnpaid > 0 && (
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--color-unpaid)' }}>${propUnpaid.toFixed(0)}</div>
              <div className="stat-label">Unpaid</div>
            </div>
          )}
          {lastPropVisit && (
            <div className="stat-card">
              <div className="stat-value" style={{ fontSize: '1rem' }}>
                {new Date(lastPropVisit).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="stat-label">Last service</div>
            </div>
          )}
        </div>
      )}

      {/* Address + service info */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}{p.state ? `, ${p.state}` : ''}{p.postal_code ? ` ${p.postal_code}` : ''}</div>
        {p.county && <div className="card-meta">{p.county} County</div>}
        <div className="divider" />
        <div className="card-row">
          <span className="text-small text-muted">Frequency</span>
          <span className={`pill pill-${p.service_frequency}`}>{p.service_frequency?.replace('_', ' ')}</span>
        </div>
        {p.default_service_package && (
          <div className="card-row" style={{ marginTop: '8px' }}>
            <span className="text-small text-muted">Package</span>
            <span className="text-small">{p.default_service_package.replace(/_/g, ' ')}</span>
          </div>
        )}
        {p.default_price != null && (
          <div className="card-row" style={{ marginTop: '8px' }}>
            <span className="text-small text-muted">Default price</span>
            <span className="font-bold">${p.default_price}</span>
          </div>
        )}
        {(p.parcel_acres != null || p.estimated_mowable_acres != null) && (
          <>
            <div className="divider" />
            {p.parcel_acres != null && (
              <div className="card-row">
                <span className="text-small text-muted">Parcel acres</span>
                <span className="text-small">{p.parcel_acres} ac</span>
              </div>
            )}
            {p.estimated_mowable_acres != null && (
              <div className="card-row" style={{ marginTop: '6px' }}>
                <span className="text-small text-muted">Mowable acres</span>
                <span className="text-small font-bold">{p.estimated_mowable_acres} ac</span>
              </div>
            )}
          </>
        )}

        <div style={{ marginTop: '12px' }}>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent([p.service_address, p.city, p.state].filter(Boolean).join(', '))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary"
          >
            Open in Maps
          </a>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="detail-section">
          <div className="section-heading">On-Site Notes</div>
          <div className="property-warnings">
            {warnings.map((w, i) => (
              <div key={i} className="warning-banner">{w}</div>
            ))}
          </div>
        </div>
      )}

      {/* Parcel Snapshot */}
      {parcel && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Parcel Data</span>
            <span className="pill pill-active" style={{ fontSize: '0.7rem' }}>Houston Co.</span>
          </div>
          {parcel.situs_address && (
            <div className="card-row">
              <span className="text-muted text-small">Parcel Address</span>
              <span className="text-small">{parcel.situs_address}</span>
            </div>
          )}
          {parcel.owner_name && (
            <div className="card-row">
              <span className="text-muted text-small">Owner on Record</span>
              <span className="text-small">{parcel.owner_name}</span>
            </div>
          )}
          {parcel.land_use && (
            <div className="card-row">
              <span className="text-muted text-small">Property Type</span>
              <span className="text-small">{parcel.land_use}</span>
            </div>
          )}
          {subdivision && subdivision.trim() !== '' && (
            <div className="card-row">
              <span className="text-muted text-small">Subdivision</span>
              <span className="text-small">{subdivision}</span>
            </div>
          )}
          {homesteadCode && homesteadCode.trim() !== '' && homesteadCode !== '0' && (
            <div className="card-row">
              <span className="text-muted text-small">Homestead</span>
              <span className="text-small" style={{ color: 'var(--color-primary)' }}>✓ Primary residence</span>
            </div>
          )}
          {parcelAcres != null && (
            <div className="card-row">
              <span className="text-muted text-small">Total Lot</span>
              <span className="font-bold">{parcelAcres.toFixed(3)} ac</span>
            </div>
          )}
          {timberAcres != null && timberAcres > 0 && (
            <div className="card-row">
              <span className="text-muted text-small">Wooded / Timber</span>
              <span className="text-small" style={{ color: 'var(--color-warning, #b45309)' }}>🌲 {timberAcres.toFixed(2)} ac</span>
            </div>
          )}
          {mowableAcres != null && (
            <div className="card-row">
              <span className="text-muted text-small">Est. Mowable</span>
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>
                ~{mowableAcres.toFixed(2)} ac
              </span>
            </div>
          )}
          {salePrice != null && salePrice > 0 && (
            <div className="card-row">
              <span className="text-muted text-small">Last Sale</span>
              <span className="text-small">
                ${salePrice.toLocaleString()}
                {deedDate && <span className="text-muted"> · {deedDate.toLocaleDateString()}</span>}
              </span>
            </div>
          )}
          {totalMktValue != null && totalMktValue > 0 && (
            <div className="card-row">
              <span className="text-muted text-small">Market Value</span>
              <span className="text-small">${totalMktValue.toLocaleString()}</span>
            </div>
          )}
          {parcelAcres != null && mowableAcres != null && (
            <div style={{ marginTop: '10px' }}>
              <ApplyParcelButton
                propertyId={p.id}
                parcelId={parcel.id}
                parcelAcres={parcelAcres}
                mowableAcres={mowableAcres}
                alreadyApplied={alreadyApplied}
              />
            </div>
          )}
        </div>
      )}

      {/* Edit form */}
      <div className="detail-section">
        <div className="section-heading">Edit Property</div>
        <div className="card">
          <PropertyForm
            action={updateProperty.bind(null, id)}
            submitLabel="Save Changes"
            cancelHref="/properties"
            customers={customers ?? []}
            defaultValues={p}
          />
        </div>
      </div>

      <PropertyAssignmentSection
        propertyId={p.id}
        currentCustomerName={currentCustomerName}
        currentCustomerStatus={currentCustomer?.status ?? null}
        currentCustomerId={p.customer_id}
        customers={customers ?? []}
        propertyStatus={p.status}
      />

      <PropertyDangerZone propertyId={p.id} />
    </div>
  )
}
