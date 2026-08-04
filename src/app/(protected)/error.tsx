'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// Route-level error boundary for the protected app. Without this file a thrown
// server-component error (e.g. the /today RangeError crashes hotfixed in
// 2ca5a86) renders Next's dead unstyled error screen with no way forward in
// the field. This keeps the operator one tap from recovery.
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app error boundary]', error)
  }, [error])

  return (
    <div className="empty-state" style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
      <h2 style={{ marginBottom: '8px' }}>Something went wrong</h2>
      <p className="text-small text-muted" style={{ marginBottom: '16px' }}>
        The page hit an unexpected error. Your data is safe — try again, or head back to Today.
        {error.digest && <span style={{ display: 'block', marginTop: '4px' }}>Ref: {error.digest}</span>}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button type="button" onClick={reset} className="btn btn-primary btn-full">
          Try Again
        </button>
        <Link href="/today" className="btn btn-secondary btn-full">
          Go to Today
        </Link>
      </div>
    </div>
  )
}
