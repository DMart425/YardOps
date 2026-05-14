import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { LeadActions } from './LeadActions'
import { ApplyParcelButton } from './ApplyParcelButton'
import { normalizeFrequency, parseWebsiteServiceInterests, formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'

const SERVICE_INTEREST_LABELS: Record<string, string> = {
  mowing: 'Lawn mowing',
  weed_eating: 'Weed eating / trimming',
  edging: 'Edging',
  blow_off: 'Blow off hard surfaces',
}

function labelForServiceInterest(value: string): string {
  return SERVICE_INTEREST_LABELS[value] ?? value.replace(/_/g, ' ')
}

function formatDefaultServices(property: {
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
  default_service_package: string | null
}) {
  const hasBooleanDefaults =
    property.default_mowing_enabled != null ||
    property.default_weed_eating_enabled != null ||
    property.default_edging_enabled != null ||
    property.default_blow_off_enabled != null

  if (!hasBooleanDefaults) {
    return {
      hasBooleanDefaults: false,
      legacyPackageLabel: property.default_service_package
        ? property.default_service_package.replace(/_/g, ' ')
        : 'Not set',
      rows: [] as Array<{ label: string; enabled: boolean }>,
    }
  }

  return {
    hasBooleanDefaults: true,
    legacyPackageLabel: null,
    rows: [
      { label: 'Mowing', enabled: property.default_mowing_enabled !== false },
      { label: 'Weed eating / trimming', enabled: property.default_weed_eating_enabled === true },
      { label: 'Edging', enabled: property.default_edging_enabled === true },
      { label: 'Blow off hard surfaces', enabled: property.default_blow_off_enabled === true },
    ],
  }
}

function getIntakeValue(notes: string | null, label: string): string | null {
  if (!notes) return null
  const regex = new RegExp(`- ${label}:\\s*(.+)`, 'i')
  const match = notes.match(regex)
  return match?.[1]?.trim() || null
}

function parseAddressParts(address: string | null): { service_address?: string; city?: string; state?: string; postal_code?: string } {
  if (!address) return {}
  const parts = address.split(',').map(part => part.trim()).filter(Boolean)
  const parsed: { service_address?: string; city?: string; state?: string; postal_code?: string } = {}

  if (parts[0]) parsed.service_address = parts[0]
  if (parts[1]) parsed.city = parts[1]
  if (parts[2]) {
    const stateZipMatch = parts[2].match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/)
    if (stateZipMatch) {
      parsed.state = stateZipMatch[1].toUpperCase()
      if (stateZipMatch[2]) parsed.postal_code = stateZipMatch[2]
    } else {
      parsed.state = parts[2].slice(0, 2).toUpperCase()
    }
  }

  return parsed
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { businessId } = await requireBusinessContext()

  const { data: customer } = await supabase
    .from('customers')
    .select(`
      id, first_name, last_name, phone, email, notes, status, created_at,
      properties ( id, service_address, city, service_frequency, access_notes, internal_notes, parcel_id, parcel_acres, estimated_mowable_acres, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled )
    `)
    .eq('id', id)
    .eq('business_id', businessId)
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
    default_service_package: string | null
    default_mowing_enabled: boolean | null
    default_weed_eating_enabled: boolean | null
    default_edging_enabled: boolean | null
    default_blow_off_enabled: boolean | null
  }> | null
  const properties = props ?? []
  const property = properties[0]
  const intakeAddress = getIntakeValue(customer.notes, 'Intake address')
  const requestedFrequency = getIntakeValue(customer.notes, 'Requested frequency')
  const normalizedFrequency = normalizeFrequency(requestedFrequency)
  const addressPrefill = parseAddressParts(intakeAddress)

  const addPropertyParams = new URLSearchParams({ customer_id: customer.id })
  if (addressPrefill.service_address) addPropertyParams.set('service_address', addressPrefill.service_address)
  if (addressPrefill.city) addPropertyParams.set('city', addressPrefill.city)
  if (addressPrefill.state) addPropertyParams.set('state', addressPrefill.state)
  if (addressPrefill.postal_code) addPropertyParams.set('postal_code', addressPrefill.postal_code)
  if (normalizedFrequency) addPropertyParams.set('service_frequency', normalizedFrequency)
  addPropertyParams.set('return_to', `/leads/${customer.id}`)
  const serviceInterests = parseWebsiteServiceInterests(customer.notes)
  if (serviceInterests.size > 0) {
    addPropertyParams.set('default_mowing_enabled',      serviceInterests.has('mowing')     ? 'true' : 'false')
    addPropertyParams.set('default_weed_eating_enabled', serviceInterests.has('weed_eating') ? 'true' : 'false')
    addPropertyParams.set('default_edging_enabled',      serviceInterests.has('edging')     ? 'true' : 'false')
    addPropertyParams.set('default_blow_off_enabled',    serviceInterests.has('blow_off')   ? 'true' : 'false')
  }
  const addPropertyHref = `/properties/new?${addPropertyParams.toString()}`
  const intakeServiceInterests = Array.from(serviceInterests)

  // Fetch any estimates already created for this lead
  const { data: estimates } = await supabase
    .from('estimates')
    .select('id, status, total, created_at')
    .eq('customer_id', id)
    .eq('business_id', businessId)
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

      {intakeServiceInterests.length > 0 && (
        <div className="card">
          <div className="section-heading">Website Intake Summary</div>
          <div className="text-small text-muted" style={{ marginBottom: '6px' }}>Requested service interests</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {intakeServiceInterests.map((interest) => (
              <span key={interest} className="pill pill-draft">{labelForServiceInterest(interest)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Properties */}
      {properties.length > 0 ? (
        <div className="detail-section">
          <div className="section-heading">Properties ({properties.length})</div>
          {properties.map((item) => {
            const defaults = formatDefaultServices(item)
            return (
              <div key={item.id} className="card">
                <div className="card-row">
                  <span className="text-muted text-small">Address</span>
                  <span className="font-bold">
                    {item.service_address}{item.city ? `, ${item.city}` : ''}
                  </span>
                </div>
                <div className="card-row">
                  <span className="text-muted text-small">Frequency</span>
                  <span>{formatFrequencyLabel(item.service_frequency)}</span>
                </div>

                {defaults.hasBooleanDefaults ? (
                  <div style={{ marginTop: '8px' }}>
                    {defaults.rows.map((row) => (
                      <div key={row.label} className="card-row" style={{ marginTop: '6px' }}>
                        <span className="text-muted text-small">{row.label}</span>
                        <span className="text-small">{row.enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card-row" style={{ marginTop: '8px' }}>
                    <span className="text-muted text-small">Legacy package</span>
                    <span className="text-small">{defaults.legacyPackageLabel}</span>
                  </div>
                )}

                {item.access_notes && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                    <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Access Notes</div>
                    <div className="text-small">{item.access_notes}</div>
                  </div>
                )}
                {item.internal_notes && (
                  <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
                    <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Internal Notes</div>
                    <div className="text-small">{item.internal_notes}</div>
                  </div>
                )}
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link
                    href={`/estimates/new?customer_id=${customer.id}&property_id=${item.id}`}
                    className="btn btn-sm btn-primary"
                  >
                    📋 Build Estimate
                  </Link>
                  <Link
                    href={`/properties/${item.id}?return_to=${encodeURIComponent(`/leads/${customer.id}`)}`}
                    className="btn btn-sm btn-secondary"
                  >
                    Edit Property
                  </Link>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(
                      [item.service_address, item.city].filter(Boolean).join(', ')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-secondary"
                  >
                    Open in Maps
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <p className="text-muted text-small">No property on record.</p>
          <p className="text-small text-muted" style={{ marginTop: '8px' }}>
            Use the Add Property action below to create the full property record.
          </p>
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
          {properties.length === 0 ? (
            <>
              <p className="text-small text-muted">Add a property first to build an estimate.</p>
              <Link href={addPropertyHref} className="btn btn-secondary btn-full">
                + Add Property
              </Link>
            </>
          ) : null}
          <Link href={`/customers/${customer.id}`} className="btn btn-secondary btn-full">
            Edit Lead / Contact
          </Link>
          <LeadActions customerId={customer.id} />
        </div>
      </div>
    </div>
  )
}
