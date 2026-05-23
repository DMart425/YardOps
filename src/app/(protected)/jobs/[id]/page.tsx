import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDateOnly, formatTimestampDate, resolveTimeZone, getLocalDateStr } from '@/lib/date'
import { JobActions } from '@/components/JobActions'
import { JobPhotos } from '@/components/JobPhotos'
import { DownloadInvoiceButton } from '@/components/DownloadInvoiceButton'
import { ScheduleFollowUpCard } from '@/components/ScheduleFollowUpCard'
import type { Job } from '@/types/database'
import { requireBusinessContext } from '@/lib/business/context'
import { formatPhoneInput } from '@/lib/format'
import { getOrCreatePortalToken } from '@/app/(protected)/customers/[id]/portal-actions'

type JobDetail = Job & {
  customers: { first_name: string; last_name: string | null; phone: string | null; email: string | null }
  properties: {
    service_address: string
    city: string | null
    state: string | null
    service_frequency: string | null
    pet_warning: string | null
    gate_code: string | null
    access_notes: string | null
    obstacle_notes: string | null
    parking_notes: string | null
  }
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

const JOB_TYPE_LABELS: Record<string, string> = {
  one_time:  'One-time',
  recurring: 'Recurring',
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const { data: jobRaw } = await supabase
    .from('jobs')
    .select(`
      *,
      customers ( first_name, last_name, phone, email ),
      properties ( service_address, city, state, service_frequency, pet_warning, gate_code, access_notes, obstacle_notes, parking_notes )
    `)
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (!jobRaw) notFound()
  const job = jobRaw as JobDetail

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, business_phone, business_email')
    .eq('id', userId)
    .single()

  const { data: business } = await supabase
    .from('businesses')
    .select('name, phone')
    .eq('id', businessId)
    .single()

  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('venmo_handle, time_zone')
    .eq('user_id', userId)
    .maybeSingle()
  const venmoHandle = (settings?.venmo_handle as string | null) ?? null
  const timeZone = resolveTimeZone(settings?.time_zone ?? null)
  // Convert completed_at ISO timestamp to the business's local YYYY-MM-DD date.
  // Used as the anchor for the follow-up suggested date so cadence resets from
  // the real service date rather than the original scheduled date.
  const completedDateLocal = job.completed_at
    ? getLocalDateStr(timeZone, new Date(job.completed_at))
    : null
  const rawBusinessPhone = business?.phone ?? profile?.business_phone ?? null
  const businessPhone = rawBusinessPhone ? formatPhoneInput(rawBusinessPhone) : null
  const businessName  = (business?.name as string | null) ?? (profile?.business_name as string | null) ?? null

  const { data: photos } = await supabase
    .from('job_photos')
    .select('id, signed_url, kind, caption, created_at')
    .eq('job_id', id)
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  const { data: jobExpenses } = await supabase
    .from('expenses')
    .select('id, category, vendor, description, amount, purchased_at')
    .eq('job_id', id)
    .eq('business_id', businessId)
    .order('purchased_at', { ascending: false })

  // Fetch follow-up job summary if one has been linked
  let nextJobSummary: {
    scheduled_date: string | null
    scheduled_time_window: string | null
    status: string
    price: number | null
  } | null = null

  if (job.next_job_created_id) {
    const { data: nextJobData } = await supabase
      .from('jobs')
      .select('scheduled_date, scheduled_time_window, status, price')
      .eq('id', job.next_job_created_id)
      .eq('business_id', businessId)
      .maybeSingle()

    nextJobSummary = nextJobData ?? null
  }

  const customer = job.customers
  const property = job.properties

  const customerName = `${customer.first_name}${customer.last_name ? ' ' + customer.last_name : ''}`
  const address      = `${property.service_address}${property.city ? ', ' + property.city : ''}`

  // Fetch portal token for invoice/receipt link in completion SMS
  let portalInvoiceUrl: string | null = null
  if (customer.phone) {
    const portalResult = await getOrCreatePortalToken(job.customer_id)
    if (!('error' in portalResult)) {
      const base = process.env.NEXT_PUBLIC_QUOTE_BASE_URL ?? 'https://app.wicksburglawnservice.com'
      portalInvoiceUrl = `${base}/portal/${portalResult.token}/invoice/${job.id}`
    }
  }

  const warnings = [
    property.pet_warning  ? `🐕 ${property.pet_warning}`  : null,
    property.gate_code    ? `🔒 Gate: ${property.gate_code}` : null,
    property.access_notes ? `🚪 ${property.access_notes}` : null,
    property.obstacle_notes ? `⚠ ${property.obstacle_notes}` : null,
    property.parking_notes  ? `🚛 ${property.parking_notes}`  : null,
  ].filter(Boolean) as string[]

  const pkgLabel = job.service_package
    ? (SERVICE_LABELS[job.service_package] ?? job.service_package.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()))
    : 'Standard Mow'

  // ── Payment row display ──
  const ps            = job.payment_status
  const payPrice      = job.price != null ? Number(job.price) : null
  const payAmtPaid    = Number(job.amount_paid ?? 0)
  const payBalance    = payPrice != null ? Math.max(0, payPrice - payAmtPaid) : null
  const showPaymentRow = job.status === 'completed' || ps === 'not_billable' || ps === 'paid' || ps === 'partial'
  const paymentRowLabel =
    ps === 'not_billable' ? '💰 Not billable' :
    ps === 'paid'         ? '💰 Paid'         :
    ps === 'partial'      ? '💰 Payment'      :
                            '💰 Balance'
  const paymentRowValue =
    ps === 'not_billable' ? 'No payment due' :
    ps === 'paid'         ? (payPrice != null ? `$${payPrice.toFixed(2)} paid in full` : 'Paid in full') :
    ps === 'partial'      ? (payPrice != null
                              ? `$${payAmtPaid.toFixed(2)} paid of $${payPrice.toFixed(2)} · $${payBalance!.toFixed(2)} remaining`
                              : `$${payAmtPaid.toFixed(2)} paid`) :
    /* unpaid */             (payPrice != null ? `$${payPrice.toFixed(2)} remaining` : 'Unpaid')

  return (
    <div className="page">
      <Link href="/jobs" className="back-link">← Jobs</Link>

      <div className="page-header" style={{ height: 'auto', minHeight: '64px', alignItems: 'flex-start', paddingTop: '14px', paddingBottom: '14px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ wordBreak: 'break-word' }}>{job.title ?? 'Job Detail'}</h1>
          <div className="text-small text-muted" style={{ marginTop: '2px' }}>{customerName} · {address}</div>
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
            <span className="text-small text-muted">� Customer</span>
            <Link href={`/customers/${job.customer_id}`} className="text-small" style={{ color: 'var(--color-primary)' }}>{customerName}</Link>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">📍 Address</span>
            <Link href={`/properties/${job.property_id}`} className="text-small" style={{ color: 'var(--color-primary)' }}>{address}</Link>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">📅 Date</span>
            <span className="text-small">
              {job.scheduled_date ? formatDateOnly(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'No date set'}
              {job.scheduled_time_window ? ` · ${job.scheduled_time_window}` : ''}
            </span>
          </div>
          {job.status === 'completed' && job.completed_at && (
            <div className="card-row">
              <span className="text-small text-muted">✅ Completed</span>
              <span className="text-small">{formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}
          <div className="card-row">
            <span className="text-small text-muted">🌿 Package</span>
            <span className="text-small">{pkgLabel}</span>
          </div>
          <div className="card-row">
            <span className="text-small text-muted">🔄 Type</span>
            <span className="text-small">{JOB_TYPE_LABELS[job.job_type ?? ''] ?? job.job_type}</span>
          </div>
          {showPaymentRow && (
            <div className="card-row">
              <span className="text-small text-muted">{paymentRowLabel}</span>
              <span className="text-small">{paymentRowValue}</span>
            </div>
          )}
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
                <span className="text-small">{formatTimestampDate(job.completed_at, timeZone, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
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

      {/* Service scope */}
      {(job.internal_notes || job.customer_notes || job.quoted_total != null) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Service Scope</div>

          {job.quoted_total != null && (
            <div className="card-row" style={{ marginBottom: '8px' }}>
              <span className="text-small text-muted">Quoted total</span>
              <span className="text-small font-bold">${Number(job.quoted_total).toFixed(2)}</span>
            </div>
          )}

          {job.internal_notes && (
            <div style={{ marginBottom: job.customer_notes ? '10px' : 0 }}>
              <span className="text-small text-muted">Operator checklist</span>
              <p className="text-small" style={{ marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {job.internal_notes}
              </p>
            </div>
          )}

          {job.customer_notes && (
            <div>
              <span className="text-small text-muted">Customer notes</span>
              <p className="text-small" style={{ marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {job.customer_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <div className="section-heading" style={{ marginBottom: '0.75rem' }}>Actions</div>
        <JobActions job={job} venmoHandle={venmoHandle} customerPhone={customer.phone} customerFirstName={customer.first_name} businessName={businessName} businessPhone={businessPhone} portalInvoiceUrl={portalInvoiceUrl} />
      </div>

      {/* Follow-up scheduling (completed jobs only) */}
      {job.status === 'completed' && !job.next_job_created_id && (
        <ScheduleFollowUpCard
          jobId={job.id}
          scheduledDate={job.scheduled_date}
          completedDate={completedDateLocal}
          serviceFrequency={property.service_frequency}
          jobType={job.job_type}
        />
      )}

      {job.status === 'completed' && job.next_job_created_id && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Follow-up Visit</div>

          {nextJobSummary ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
              <div className="card-row">
                <span className="text-small text-muted">📅 Date</span>
                <span className="text-small">
                  {nextJobSummary.scheduled_date
                    ? formatDateOnly(nextJobSummary.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                    : 'No date set'}
                  {nextJobSummary.scheduled_time_window ? ` · ${nextJobSummary.scheduled_time_window}` : ''}
                </span>
              </div>
              <div className="card-row">
                <span className="text-small text-muted">Status</span>
                <span className={`pill pill-${nextJobSummary.status}`}>
                  {nextJobSummary.status.replace(/_/g, ' ')}
                </span>
              </div>
              {nextJobSummary.price != null && (
                <div className="card-row">
                  <span className="text-small text-muted">💰 Price</span>
                  <span className="text-small">${Number(nextJobSummary.price).toFixed(0)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
              A follow-up visit has been scheduled for this completed job.
            </p>
          )}

          <Link href={`/jobs/${job.next_job_created_id}`} className="btn btn-sm btn-secondary">
            Open Follow-up Job
          </Link>
        </div>
      )}

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
              businessName:   businessName ?? 'Lawn Service',
              businessPhone:  businessPhone,
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
              timeZone,
              invoiceNumber:  job.id.slice(0, 8).toUpperCase(),
            }}
          />
        </div>
      )}

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
        <Link href={`/customers/${job.customer_id}`} className="btn btn-sm btn-secondary">Customer</Link>
        <Link href={`/properties/${job.property_id}`} className="btn btn-sm btn-secondary">Property</Link>
        {job.estimate_id && (
          <Link href={`/estimates/${job.estimate_id}`} className="btn btn-sm btn-secondary">View Estimate →</Link>
        )}
      </div>
    </div>
  )
}
