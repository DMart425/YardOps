'use client'

import { useState } from 'react'
import { logReviewRequest } from '@/app/(protected)/jobs/actions'
import { launchSms } from '@/components/SmsLink'
import type { SmsMode } from '@/lib/sms'

// Discretionary post-payment review ask. Shown only on paid jobs, only when a
// review link is configured, and only for customers who have never been asked
// (checked server-side via message_logs). Never attached to receipt SMS —
// the operator decides who gets asked.
export function ReviewRequestButton({
  customerId,
  jobId,
  customerPhone,
  customerFirstName,
  businessName,
  reviewUrl,
  smsMode = 'device',
}: {
  customerId: string
  jobId: string
  customerPhone: string
  customerFirstName: string | null
  businessName: string | null
  reviewUrl: string
  smsMode?: SmsMode
}) {
  const [asked, setAsked] = useState(false)
  if (asked) {
    return <p className="text-small text-muted" style={{ margin: 0 }}>Review request sent — this customer won&apos;t be asked again.</p>
  }

  const body =
    `Hi ${customerFirstName ?? ''}, glad you're happy with the yard! ` +
    `If you have a minute, a quick Google review would mean a lot: ${reviewUrl}` +
    `${businessName ? ` — ${businessName}` : ''}`

  function handleClick() {
    // Log first (fire-and-forget) so the ask is recorded even if the SMS
    // compose is abandoned; then open the operator's messaging app.
    logReviewRequest(customerId, jobId, body).catch(() => {})
    setAsked(true)
    launchSms(customerPhone, body, smsMode)
  }

  return (
    <button type="button" onClick={handleClick} className="btn btn-secondary btn-full">
      ⭐ Ask for a Review
    </button>
  )
}
