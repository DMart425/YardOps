'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { markNotificationReviewed } from '@/app/(protected)/notifications/actions'
import type { AppNotification, FormState } from '@/types/database'

type Props = {
  notifications: AppNotification[]
}

function fmtDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ReviewButton({ notificationId }: { notificationId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(markNotificationReviewed, { error: null })

  return (
    <form action={action}>
      <input type="hidden" name="notification_id" value={notificationId} />
      <button type="submit" className="btn btn-sm btn-secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Mark Reviewed'}
      </button>
      {state.error && <div className="text-small" style={{ color: 'var(--color-danger)', marginTop: '6px' }}>{state.error}</div>}
    </form>
  )
}

export function EstimateApprovalNotifications({ notifications }: Props) {
  if (!notifications.length) return null

  const heading = notifications.length === 1
    ? '1 New Estimate Approved'
    : `${notifications.length} New Estimates Approved`

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.75rem' }}>{heading}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {notifications.map((notification, index) => (
          <div
            key={notification.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
              paddingBottom: index === notifications.length - 1 ? '0' : '10px',
              borderBottom: index === notifications.length - 1 ? 'none' : '1px solid var(--color-border)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Link href={notification.link_path} className="card-title" style={{ textDecoration: 'none' }}>
                {notification.title}
              </Link>
              {notification.body && <div className="text-small text-muted" style={{ marginTop: '4px' }}>{notification.body}</div>}
              <div className="text-small text-muted" style={{ marginTop: '4px' }}>{fmtDate(notification.created_at)}</div>
            </div>
            <ReviewButton notificationId={notification.id} />
          </div>
        ))}
      </div>
    </div>
  )
}