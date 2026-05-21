import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Customer, Property } from '@/types/database'
import { CopyPortalLinkButton } from '@/components/CopyPortalLinkButton'
import { formatDateOnly, formatTimestampDate, getLocalDateStr, resolveTimeZone } from '@/lib/date'
import { formatFrequencyLabel } from '@/lib/frequency'
import { requireBusinessContext } from '@/lib/business/context'
import { CustomerDangerZone } from './CustomerDangerZone'
import { LeadStatusActions } from './LeadStatusActions'
import { CustomerInfoSection } from './CustomerInfoSection'

type CustomerWithTags = Customer & { tags?: string[] | null; business_id?: string | null }

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const timeZone = resolveTimeZone(settings?.time_zone ?? null)
  const today = getLocalDateStr(timeZone)

  const [
    { data: customer },
    { data: properties },
    { data: nextVisitJob },
    { count: completedJobsCount },
    { data: completedJobsStats },
    { data: lastCompletedJob },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('business_id', businessId).single(),
    supabase
      .from('properties')
      .select(
        'id, property_name, service_address, city, service_frequency, preferred_service_day, default_price, default_service_package, default_mowing_enabled, default_weed_eating_enabled, default_edging_enabled, default_blow_off_enabled, status'
      )
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .order('service_address'),
    supabase
      .from('jobs')
      .select('id, scheduled_date, scheduled_time_window')
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .in('status', ['scheduled', 'in_progress', 'needs_reschedule'])
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Completed jobs count for Jobs done stat.
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .eq('status', 'completed'),
    // Completed-job fields for revenue/unpaid stats and outstanding balance list.
    supabase
      .from('jobs')
      .select('id, title, completed_at, price, amount_paid, payment_status')
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .eq('status', 'completed'),
    // Last visit needs only the most recent completed timestamp.
    supabase
      .from('jobs')
      .select('completed_at')
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!customer) notFound()
  const customerRow = customer as CustomerWithTags
  if (customerRow.business_id !== businessId) notFound()

  const completedCount = completedJobsCount ?? 0
  const completedStatsRows = completedJobsStats ?? []
  const totalRevenue = completedStatsRows.reduce((s, j) => s + Number(j.price ?? 0), 0)
  const totalUnpaid = completedStatsRows
    .filter(j => j.payment_status !== 'paid')
    .reduce((s, j) => {
      const owed = Number(j.price ?? 0) - Number((j.amount_paid || null) ?? 0)
      return s + Math.max(0, owed)
    }, 0)
  const outstandingJobs = completedStatsRows
    .filter(j => (j.payment_status === 'unpaid' || j.payment_status === 'partial') && Math.max(0, Number(j.price ?? 0) - Number(j.amount_paid ?? 0)) > 0)
    .sort((a, b) => {
      if (!a.completed_at && !b.completed_at) return 0
      if (!a.completed_at) return 1
      if (!b.completed_at) return -1
      return b.completed_at.localeCompare(a.completed_at)
    })
  const lastVisit = lastCompletedJob?.completed_at ?? null
  const propertyRows = (properties as Pick<Property, 'id' | 'property_name' | 'service_address' | 'city' | 'service_frequency' | 'preferred_service_day' | 'default_price' | 'default_service_package' | 'default_mowing_enabled' | 'default_weed_eating_enabled' | 'default_edging_enabled' | 'default_blow_off_enabled' | 'status'>[] | null) ?? []
  const activeProperties = propertyRows.filter(p => p.status !== 'archived')
  const archivedProperties = propertyRows.filter(p => p.status === 'archived')
  const mapProperty = activeProperties[0] ?? archivedProperties[0] ?? null
  const mapsAddress = mapProperty
    ? [mapProperty.service_address, mapProperty.city].filter(Boolean).join(', ')
    : null

  return (
    <div className="page">
      <Link href="/customers" className="back-link">← Customers</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">
            {customerRow.first_name}{customerRow.last_name ? ` ${customerRow.last_name}` : ''}
          </h1>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
            <span className={`pill pill-${customerRow.status}`}>{customerRow.status}</span>
            {customerRow.status !== 'lead' && (customerRow.tags ?? []).map((tag: string) => (
              <span key={tag} className="pill pill-draft">{tag}</span>
            ))}
          </div>
        </div>
        <Link href={`/jobs/new?customer_id=${id}`} className="btn btn-header btn-sm">
          + New Job
        </Link>
      </div>

      {customerRow.status === 'lead' && (
        <div className="detail-section">
          <div className="section-heading">Lead Status</div>
          <div className="card">
            <p className="text-small text-muted" style={{ marginBottom: '10px' }}>
              This contact is currently a lead.
            </p>
            <LeadStatusActions customerId={customerRow.id} />
          </div>
        </div>
      )}

      <CustomerInfoSection customer={customerRow} mapsAddress={mapsAddress} />

      <div className="detail-section">
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div className="section-heading" style={{ marginBottom: '8px' }}>Job History</div>
            <p className="text-small text-muted" style={{ margin: 0 }}>
              View this customer&apos;s recent jobs without loading full history on the customer detail page.
            </p>
          </div>
          <Link href={`/jobs?customer_id=${id}`} className="btn btn-sm btn-secondary">
            View all jobs
          </Link>
        </div>
      </div>

      {/* History stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{completedCount}</div>
          <div className="stat-label">Jobs done</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${totalRevenue.toFixed(0)}</div>
          <div className="stat-label">Total billed</div>
        </div>
        {totalUnpaid > 0 && (
          <Link href={`/jobs?view=completed&filter=unpaid&customer_id=${id}`} className="stat-card" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="stat-value" style={{ color: 'var(--color-unpaid)' }}>${totalUnpaid.toFixed(0)}</div>
            <div className="stat-label">Unpaid</div>
          </Link>
        )}
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>
            {lastVisit ? formatTimestampDate(lastVisit, timeZone) : 'Not yet'}
          </div>
          <div className="stat-label">Last visit</div>
        </div>
        {nextVisitJob?.id && nextVisitJob.scheduled_date ? (
          <Link href={`/jobs/${nextVisitJob.id}`} className="stat-card" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>
              {formatDateOnly(nextVisitJob.scheduled_date)}
            </div>
            <div className="stat-label">
              {nextVisitJob.scheduled_time_window ? `Next visit · ${nextVisitJob.scheduled_time_window}` : 'Next visit'}
            </div>
          </Link>
        ) : (
          <div className="stat-card">
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>Not scheduled</div>
            <div className="stat-label">Next visit</div>
          </div>
        )}
      </div>

      {/* Outstanding Balance */}
      {outstandingJobs.length > 0 && (
        <div className="detail-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="section-heading" style={{ marginBottom: 0 }}>Outstanding Balance</div>
            <span style={{ fontWeight: 700, color: 'var(--color-unpaid)', fontSize: '0.875rem' }}>
              ${totalUnpaid.toFixed(2)} across {outstandingJobs.length} job{outstandingJobs.length !== 1 ? 's' : ''}
            </span>
          </div>
          {outstandingJobs.map((j) => {
            const balance = Math.max(0, Number(j.price ?? 0) - Number(j.amount_paid ?? 0))
            return (
              <Link key={j.id} href={`/jobs/${j.id}`} style={{ display: 'block' }}>
                <div className="card">
                  <div className="card-row">
                    <div>
                      <div className="card-title">{j.title ?? 'Lawn Service'}</div>
                      <div className="card-meta">
                        {j.completed_at
                          ? formatTimestampDate(j.completed_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric' })
                          : 'No completion date'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span className={`pill pill-${j.payment_status}`}>
                        {j.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-unpaid)', fontSize: '0.875rem' }}>
                        ${balance.toFixed(2)} due
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Properties */}
      <div className="detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            Properties ({activeProperties.length})
          </div>
          <Link href={`/properties/new?customer_id=${id}`} className="btn btn-sm btn-secondary">
            + Add Property
          </Link>
        </div>

        {!activeProperties.length ? (
          <div className="card">
            <p className="text-muted text-small">No properties yet.</p>
          </div>
        ) : (
          activeProperties.map((p) => {
            const frequency = p.service_frequency ? formatFrequencyLabel(p.service_frequency) : null
            const preferredDay = p.preferred_service_day
              ? p.preferred_service_day.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              : 'No preferred day'

            let serviceOptions: string | null = null
            const hasBooleans =
              p.default_mowing_enabled !== null ||
              p.default_weed_eating_enabled !== null ||
              p.default_edging_enabled !== null ||
              p.default_blow_off_enabled !== null
            if (hasBooleans) {
              const services: string[] = []
              if (p.default_mowing_enabled) services.push('Mowing')
              if (p.default_weed_eating_enabled) services.push('Weed Eating')
              if (p.default_edging_enabled) services.push('Edging')
              if (p.default_blow_off_enabled) services.push('Blow Off')
              serviceOptions = services.length > 0 ? services.join(', ') : null
            }
            if (!serviceOptions && p.default_service_package) {
              serviceOptions = p.default_service_package.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            }
            const defaultPrice = p.default_price != null ? `$${p.default_price}` : null

            return (
              <div key={p.id} className="card">
                <div className="card-row">
                  <div>
                    <div className="card-title">{p.property_name ?? p.service_address}</div>
                    {p.property_name && <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>}
                    {frequency && <div className="card-meta">🔁 {frequency}</div>}
                    <div className="card-meta">📅 {preferredDay}</div>
                    {serviceOptions && <div className="card-meta">⚙ {serviceOptions}</div>}
                    {defaultPrice && <div className="card-meta">💲 {defaultPrice}</div>}
                  </div>
                  <span className={`pill pill-${p.status}`}>{p.status}</span>
                </div>
                <div className="card-actions">
                  <Link href={`/properties/${p.id}`} className="btn btn-sm btn-secondary">Edit Property</Link>
                </div>
              </div>
            )
          })
        )}

        {archivedProperties.length > 0 && (
          <div style={{ marginTop: '14px' }}>
            <div className="section-heading" style={{ marginBottom: '8px', fontSize: '0.95rem' }}>
              Archived Properties ({archivedProperties.length})
            </div>
            {archivedProperties.map((p) => {
              const frequency = p.service_frequency ? formatFrequencyLabel(p.service_frequency) : null
              const preferredDay = p.preferred_service_day
                ? p.preferred_service_day.replace(/_/g, ' ')
                : 'No preferred day'

              let serviceOptions: string | null = null
              const hasBooleans =
                p.default_mowing_enabled !== null ||
                p.default_weed_eating_enabled !== null ||
                p.default_edging_enabled !== null ||
                p.default_blow_off_enabled !== null
              if (hasBooleans) {
                const services: string[] = []
                if (p.default_mowing_enabled) services.push('Mowing')
                if (p.default_weed_eating_enabled) services.push('Weed Eating')
                if (p.default_edging_enabled) services.push('Edging')
                if (p.default_blow_off_enabled) services.push('Blow Off')
                serviceOptions = services.length > 0 ? services.join(', ') : null
              }
              if (!serviceOptions && p.default_service_package) {
                serviceOptions = p.default_service_package.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
              }
              const defaultPrice = p.default_price != null ? `$${p.default_price}` : null

              return (
                <div key={p.id} className="card" style={{ opacity: 0.92 }}>
                  <div className="card-row">
                    <div>
                      <div className="card-title">{p.property_name ?? p.service_address}</div>
                      {p.property_name && <div className="card-meta">{p.service_address}{p.city ? `, ${p.city}` : ''}</div>}
                      {frequency && <div className="card-meta">🔁 {frequency}</div>}
                      <div className="card-meta">📅 {preferredDay}</div>
                      {serviceOptions && <div className="card-meta">⚙ {serviceOptions}</div>}
                      {defaultPrice && <div className="card-meta">💲 {defaultPrice}</div>}
                    </div>
                    <span className={`pill pill-${p.status}`}>{p.status}</span>
                  </div>
                  <div className="card-actions">
                    <Link href={`/properties/${p.id}`} className="btn btn-sm btn-secondary">Edit Property</Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>


      {/* Edit form */}
      {/* Portal link */}
      <div className="detail-section">
        <div className="section-heading">Customer Portal</div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>Share with customer</div>
            <div className="text-small text-muted">They can view upcoming jobs, history &amp; balance — no login needed</div>
          </div>
          <CopyPortalLinkButton customerId={customerRow.id} />
        </div>
      </div>

      <CustomerDangerZone customerId={customerRow.id} />
    </div>
  )
}
