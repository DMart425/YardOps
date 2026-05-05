import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WebsiteLeadDangerZone, WebsiteLeadStatusActions } from './WebsiteLeadActions'
import { estimateMowableAcres } from '@/lib/pricing'

export default async function WebsiteLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('status', 'new')
    .single()

  if (!lead) notFound()

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
  if (lead.address) {
    const searchTerm = lead.address.split(',')[0].trim()
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
  const parcelAcres     = parcel?.lot_sqft ? parcel.lot_sqft / 43560 : null
  const timberAcres     = toNum(attrs['TimberAcres'])
  const effectiveTimber = (timberAcres != null && timberAcres > 0 && parcelAcres != null && timberAcres < parcelAcres) ? timberAcres : 0
  const mowableAcres    = parcelAcres != null && parcel ? estimateMowableAcres(parcelAcres, effectiveTimber, parcel.land_use) : null
  const subdivision     = attrs['SubDivision'] as string | null | undefined
  const homesteadCode   = attrs['HomesteadCode'] as string | null | undefined
  const salePrice       = toNum(attrs['SalePrice'])
  const deedDateMs      = toNum(attrs['DeedDate'])
  const deedDate        = deedDateMs ? new Date(deedDateMs) : null
  const totalMktValue   = toNum(attrs['TotalMktValue'])

  return (
    <div className="page">
      <Link href="/leads" className="back-link">← Leads</Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">{lead.name}</h1>
          <p className="page-subtitle">Website request</p>
        </div>
        <span className="pill pill-lead">Website</span>
      </div>

      <div className="detail-section">
        <div className="section-heading">Lead Status</div>
        <div className="card">
          <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
            This contact came from your website.
          </p>
          <WebsiteLeadStatusActions leadId={id} />
        </div>
      </div>

      <div className="detail-section">
        <div className="section-heading">Contact Info</div>
        <div className="card">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="contact-row">
              📞 {lead.phone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="contact-row">
              ✉ {lead.email}
            </a>
          )}
          <div className="contact-row text-muted">
            📍 {lead.address}
          </div>
          <div className="divider" />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>
            )}
            {lead.phone && (
              <a href={`sms:${lead.phone}`} className="btn btn-sm btn-secondary">💬 Text</a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="btn btn-sm btn-secondary">✉ Email</a>
            )}
            {lead.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                📍 Maps
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="detail-section">
        <div className="section-heading">Request Details</div>
        <div className="card">
          <div className="card-row">
            <span className="text-muted text-small">Requested Service</span>
            <span>{lead.frequency || 'Not specified'}</span>
          </div>

          {lead.notes ? (
            <div style={{ marginTop: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
              <div className="text-small text-muted" style={{ marginBottom: '2px' }}>Customer Notes</div>
              <div className="text-small">{lead.notes}</div>
            </div>
          ) : (
            <div className="text-small text-muted" style={{ marginTop: '8px' }}>
              No customer notes provided.
            </div>
          )}

          {parcel && (
            <>
              <div className="divider" />
              <div className="section-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
            </>
          )}
        </div>
      </div>

      <div className="detail-section">
        <div className="section-heading" style={{ color: 'var(--color-danger)' }}>Danger Zone</div>
        <div className="card" style={{ borderColor: '#fca5a5' }}>
          <WebsiteLeadDangerZone leadId={id} />
        </div>
      </div>
    </div>
  )
}
