import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { JobActions } from '@/components/JobActions'
import { JobPhotos } from '@/components/JobPhotos'
import { DownloadInvoiceButton } from '@/components/DownloadInvoiceButton'
import type { Job } from '@/types/database'

type JobDetail = Job & {
  customers: { first_name: string; last_name: string | null; phone: string | null; email: string | null }
  properties: {
    service_address: string
    city: string | null
    state: string | null
    pet_warning: string | null
    gate_code: string | null
    access_notes: string | null
    obstacle_notes: string | null
    parking_notes: string | null
  }
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: jobRaw } = await supabase
    .from('jobs')
    .select(`
      *,
      customers ( first_name, last_name, phone, email ),
      properties ( service_address, city, state, pet_warning, gate_code, access_notes, obstacle_notes, parking_notes )
    `)
    .eq('id', id)
    .single()

  if (!jobRaw) notFound()
  const job = jobRaw as JobDetail

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, business_phone, business_email')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('venmo_handle')
    .single()
  const venmoHandle = (settings?.venmo_handle as string | null) ?? null

  const { data: photos } = await supabase
    .from('job_photos')
    .select('id, signed_url, kind, caption, created_at')
    .eq('job_id', id)
    .order('created_at', { ascending: true })

  const { data: jobExpenses } = await supabase
    .from('expenses')
    .select('id, category, vendor, description, amount, purchased_at')
    .eq('job_id', id)
    .order('purchased_at', { ascending: false })

  const customer = job.customers
  const property = job.properties

  const customerName = `${customer.first_name}${customer.last_name ? ' ' + customer.last_name : ''}`
  const address      = `${property.service_address}${property.city ? ', ' + property.city : ''}`

  const warnings = [
    property.pet_warning  ? `🐕 ${property.pet_warning}`  : null,
    property.gate_code    ? `🔒 Gate: ${property.gate_code}` : null,
    property.access_notes ? `🚪 ${property.access_notes}` : null,
    property.obstacle_notes ? `⚠ ${property.obstacle_notes}` : null,
    property.parking_notes  ? `🚛 ${property.parking_notes}`  : null,
  ].filter(Boolean) as string[]

  const pkgLabel = job.service_package
    ? job.service_package.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : 'Standard Mow'

  return (
    <div className="page">
      <Link href="/jobs" className="back-link">← Jobs</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customerName}</h1>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span className={`pill pill-${job.status}`}>{job.status.replace(/_/g, ' ')}</span>
            {job.status !== 'cancelled' && job.status !== 'skipped' && (
              <span className={`pill pill-${job.payment_status}`}>{job.payment_status.replace(/_/g, ' ')}</span>
            )}
          </div>
        </div>
        {job.price != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>${job.price}</div>
            <div className="text-small text-muted">price</div>
          </div>
        )}
      </div>

      {/* Job info */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="card-row">
            <span className="text-small text-muted">📅 Date</span>
            <span className="text-small">
              {job.scheduled_date ? fmtDate(job.scheduled_date) : 'No date set'}
              {job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}
            </span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">📍 Address</span>
            <span className="text-small">{address}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">🌿 Package</span>
            <span className="text-small">{pkgLabel}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">🔄 Type</span>
            <span className="text-small">{job.job_type}</span>
          </div>
        </div>

        {customer.phone && (
          <>
            <div className="divider" />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href={`tel:${customer.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>
              <a href={`sms:${customer.phone}`} className="btn btn-sm btn-secondary">💬 Text</a>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                📍 Maps
              </a>
            </div>
          </>
        )}
      </div>

      {/* On-site warnings */}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
          {warnings.map((w, i) => (
            <div key={i} className="warning-banner">{w}</div>
          ))}
        </div>
      )}

      {/* Completion notes */}
      {job.status === 'completed' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Job Summary</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
            {job.actual_minutes != null && (
              <div className="card-row">
                <span className="text-small text-muted">⏱️ Time worked</span>
                <span className="text-small">{job.actual_minutes} min</span>
              </div>
            )}
            {job.completed_at && (
              <div className="card-row">
                <span className="text-small text-muted">✅ Completed</span>
                <span className="text-small">{new Date(job.completed_at).toLocaleString()}</span>
              </div>
            )}
            {job.completion_notes && (
              <div style={{ paddingTop: '4px' }}>
                <span className="text-small text-muted">Notes</span>
                <p className="text-small" style={{ marginTop: '4px' }}>{job.completion_notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Actions</div>
        <JobActions job={job} venmoHandle={venmoHandle} customerPhone={customer.phone} customerFirstName={customer.first_name} />
      </div>

      {/* Reschedule history */}
      {(job.reschedule_count ?? 0) > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.5rem' }}>
            Reschedule History ({job.reschedule_count}x)
          </div>
          {job.reschedule_log && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {String(job.reschedule_log).split('\n').map((line, i) => (
                <div key={i} className="text-small text-muted" style={{ borderLeft: '2px solid var(--color-border)', paddingLeft: '8px' }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Photos</div>
        <JobPhotos jobId={job.id} photos={photos ?? []} />
      </div>

      {/* Job-tagged expenses */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="section-heading" style={{ marginBottom: 0 }}>
            Expenses{(jobExpenses?.length ?? 0) > 0 ? ` ($${(jobExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0).toFixed(2)})` : ''}
          </div>
          <Link href={`/finances/expenses/new?job_id=${job.id}`} className="btn btn-sm btn-secondary">
            + Add
          </Link>
        </div>
        {!jobExpenses || jobExpenses.length === 0 ? (
          <p className="text-small text-muted" style={{ textAlign: 'center', padding: '8px 0' }}>
            No expenses tagged to this job. Tap + Add for items bought specifically for this job.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {jobExpenses.map((e) => (
              <Link key={e.id} href={`/finances/expenses/${e.id}`} className="card-row" style={{ padding: '4px 0', textDecoration: 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-small font-bold">{e.description ?? e.vendor ?? e.category}</div>
                  <div className="card-meta">{e.category}{e.vendor ? ' · ' + e.vendor : ''}</div>
                </div>
                <div className="font-bold text-small" style={{ flexShrink: 0 }}>${Number(e.amount).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Invoice download (completed jobs only) */}
      {job.status === 'completed' && job.price != null && (
        <div style={{ marginTop: '1rem' }}>
          <DownloadInvoiceButton
            data={{
              businessName:   profile?.business_name ?? 'Wicksburg Lawn Service',
              businessPhone:  profile?.business_phone ?? null,
              businessEmail:  profile?.business_email ?? null,
              customerName,
              customerPhone:  customer.phone,
              customerEmail:  customer.email,
              serviceAddress: address,
              jobTitle:       job.title ?? 'Lawn Service',
              jobDate:        job.completed_at ?? job.scheduled_date,
              servicePackage: job.service_package,
              price:          Number(job.price),
              amountPaid:     Number(job.amount_paid ?? 0),
              paymentStatus:  job.payment_status,
              paymentMethod:  job.payment_method,
              notes:          job.completion_notes,
              venmoHandle,
              invoiceNumber:  job.id.slice(0, 8).toUpperCase(),
            }}
          />
        </div>
      )}

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
        <Link href={`/customers/${job.customer_id}`} className="btn btn-sm btn-secondary">Customer</Link>
        <Link href={`/properties/${job.property_id}`} className="btn btn-sm btn-secondary">Property</Link>
      </div>
    </div>
  )
}
