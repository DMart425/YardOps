import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LeadActions } from './LeadActions'
import { ApplyParcelButton } from './ApplyParcelButton'

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select(`
      id, first_name, last_name, phone, email, notes, status, created_at,
      properties ( id, service_address, city, service_frequency, access_notes, internal_notes, parcel_id, parcel_acres, estimated_mowable_acres )
    `)
    .eq('id', id)
    .eq('status', 'lead')
    .single()

  if (!customer) notFound()

  const props = customer.properties as Array<{
    id: string
    service_address: string
    city: string | null
    service_frequency: string
    access_notes: string | null
    internal_notes: string | null
    parcel_id: string | null
    parcel_acres: number | null
    estimated_mowable_acres: number | null
  }> | null
  const property = props?.[0]

  // Fetch any estimates already created for this lead
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, status, total, created_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Parcel lookup — fuzzy match on street address
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
  if (property?.service_address) {
    const searchTerm = property.service_address.split(',')[0].trim()
    const { data: parcelMatch } = await supabase
      .from('parcels')
      .select('id, situs_address, lot_sqft, owner_name, land_use, lat, lon, raw_json')
      .ilike('situs_address', `%${searchTerm}%`)
      .limit(1)
      .single()
    parcel = (parcelMatch as ParcelRow) ?? null
  }

  const attrs = parcel?.raw_json?.attributes ?? {}
  const toNum = (v: unknown) => { const n = parseFloat(String(v)); return (v != null && v !== '' && !isNaN(n)) ? n : null }
  // Use lot_sqft from the DB row as the authoritative size (raw_json acres are often 0)
  const parcelAcres   = parcel?.lot_sqft ? parcel.lot_sqft / 43560 : null
  const timberAcres   = toNum(attrs['TimberAcres'])
  // Only deduct timber if it's a sane value (> 0 and less than total)
  const effectiveTimber = (timberAcres != null && timberAcres > 0 && parcelAcres != null && timberAcres < parcelAcres)
    ? timberAcres : 0
  const mowableBase   = parcelAcres != null ? parcelAcres - effectiveTimber : null
  const mowableAcres  = mowableBase != null ? Math.round(mowableBase * 0.7 * 100) / 100 : null

  const subdivision   = attrs['SubDivision'] as string | null | undefined
  const homesteadCode = attrs['HomesteadCode'] as string | null | undefined
  const salePrice     = toNum(attrs['SalePrice'])
  const deedDateMs    = toNum(attrs['DeedDate'])
  const deedDate      = deedDateMs ? new Date(deedDateMs) : null
  const totalMktValue = toNum(attrs['TotalMktValue'])

  return (
    <div className="page">
      <Link href="/leads" className="back-link">← Leads</Link>
      <div className="page-header">
        <h1 className="page-title">
          {customer.first_name}{customer.last_name ? ` ${customer.last_name}` : ''}
        </h1>
        <span className="pill pill-lead">Lead</span>
      </div>

      {/* Contact */}
      <div className="card">
        <div className="section-heading">Contact</div>
        {customer.phone && (
          <div className="card-row">
            <span className="text-muted text-small">Phone</span>
            <a href={`tel:${customer.phone}`} className="font-bold">{customer.phone}</a>
          </div>
        )}
        {customer.email && (
          <div className="card-row">
            <span className="text-muted text-small">Email</span>
            <a href={`mailto:${customer.email}`} className="font-bold">{customer.email}</a>
          </div>
        )}
        {!customer.phone && !customer.email && (
          <p className="text-muted text-small">No contact info saved.</p>
        )}
        {customer.notes && (
          <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
            <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Notes</div>
            <div className="text-small">{customer.notes}</div>
          </div>
        )}
      </div>

      {/* Property */}
      {property ? (
        <div className="card">
          <div className="section-heading">Property</div>
          <div className="card-row">
            <span className="text-muted text-small">Address</span>
            <span className="font-bold">
              {property.service_address}{property.city ? `, ${property.city}` : ''}
            </span>
          </div>
          <div className="card-row">
            <span className="text-muted text-small">Frequency</span>
            <span>{property.service_frequency.replace(/_/g, ' ')}</span>
          </div>
          {property.access_notes && (
            <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Access Notes</div>
              <div className="text-small">{property.access_notes}</div>
            </div>
          )}
          {property.internal_notes && (
            <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Internal Notes</div>
              <div className="text-small">{property.internal_notes}</div>
            </div>
          )}
          <div style={{ marginTop: '12px' }}>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(
                [property.service_address, property.city].filter(Boolean).join(', ')
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-secondary"
            >
              Open in Maps
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="text-muted text-small">No property on record.</p>
        </div>
      )}

      {/* Parcel Snapshot */}
      {parcel && property && (
        <div className="card">
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
          {parcel.lat && parcel.lon && (
            <div className="card-row">
              <span className="text-muted text-small">Coordinates</span>
              <a
                href={`https://maps.google.com/?q=${parcel.lat},${parcel.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-small"
                style={{ color: 'var(--color-primary)' }}
              >
                {parcel.lat.toFixed(5)}, {parcel.lon.toFixed(5)}
              </a>
            </div>
          )}
          {parcelAcres != null && mowableAcres != null && (
            <div style={{ marginTop: '10px' }}>
              <ApplyParcelButton
                propertyId={property.id}
                parcelId={parcel.id}
                parcelAcres={parcelAcres}
                mowableAcres={mowableAcres}
                alreadyApplied={property.parcel_id === parcel.id}
              />
            </div>
          )}
        </div>
      )}

      {/* Estimates */}
      {(estimates?.length ?? 0) > 0 && (
        <div className="detail-section">
          <div className="section-heading">Estimates</div>
          {estimates!.map((e) => (
            <Link key={e.id} href={`/estimates/${e.id}`} style={{ display: 'block' }}>
              <div className="card">
                <div className="card-row">
                  <span className="text-small">{new Date(e.created_at).toLocaleDateString()}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {e.total != null && <span className="font-bold">${Number(e.total).toFixed(0)}</span>}
                    <span className={`pill pill-${e.status}`}>{e.status}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <div className="section-heading">Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {property ? (
            <Link
              href={`/estimates/new?customer_id=${customer.id}&property_id=${property.id}`}
              className="btn btn-primary btn-full"
            >
              📋 Build Estimate
            </Link>
          ) : (
            <p className="text-small text-muted">Add a property first to build an estimate.</p>
          )}
          <LeadActions customerId={customer.id} />
        </div>
      </div>
    </div>
  )
}
