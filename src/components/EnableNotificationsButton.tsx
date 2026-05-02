'use client'

import { useEffect, useState } from 'react'
import { savePushSubscription, deletePushSubscription } from '@/app/(protected)/settings/push-actions'

// Convert the base64 VAPID public key into a Uint8Array, which is what
// pushManager.subscribe() requires.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function EnableNotificationsButton() {
  const [supported, setSupported]     = useState(false)
  const [permission, setPermission]   = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed]   = useState(false)
  const [busy, setBusy]               = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setSupported(ok)
    if (!ok) return

    setPermission(Notification.permission)

    // Check existing subscription state
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      if (!reg) return
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    })
  }, [])

  async function handleEnable() {
    setError(null)
    setBusy(true)
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) throw new Error('Push key not configured.')

      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 2. Request permission
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        throw new Error('Notification permission was not granted.')
      }

      // 3. Subscribe with the push service
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      // 4. Send subscription to server
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const result = await savePushSubscription(
        { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
        navigator.userAgent,
      )
      if (!result.success) throw new Error(result.error || 'Failed to save subscription')
      setSubscribed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable notifications')
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    setError(null)
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await deletePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setSubscribed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable')
    } finally {
      setBusy(false)
    }
  }

  async function handleTest() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Test failed')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setBusy(false)
    }
  }

  if (!supported) {
    return (
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Notifications</div>
        <p className="text-small text-muted">
          This browser doesn&apos;t support push notifications. Try Chrome on Android.
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <div className="section-heading" style={{ marginBottom: '0.5rem' }}>Notifications</div>
      <p className="text-small text-muted" style={{ marginBottom: '0.75rem' }}>
        {subscribed
          ? 'Daily morning summary will arrive at 6:00 AM.'
          : 'Get a daily summary of today\u2019s jobs at 6:00 AM, plus alerts for new estimates.'}
      </p>

      {permission === 'denied' && (
        <p className="text-small" style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>
          Notifications are blocked in your browser settings. Open Chrome → site settings → allow notifications.
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {!subscribed ? (
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy || permission === 'denied'}
            className="btn btn-primary btn-sm"
          >
            {busy ? 'Working...' : '🔔 Enable Notifications'}
          </button>
        ) : (
          <>
            <button type="button" onClick={handleTest} disabled={busy} className="btn btn-secondary btn-sm">
              {busy ? 'Sending...' : 'Send Test'}
            </button>
            <button type="button" onClick={handleDisable} disabled={busy} className="btn btn-secondary btn-sm">
              Disable
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="text-small" style={{ color: '#b91c1c', marginTop: '0.5rem' }}>{error}</p>
      )}
    </div>
  )
}
