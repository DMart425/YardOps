'use client'

import { useState, useTransition } from 'react'
import { getOrCreatePortalToken } from '@/app/(protected)/customers/[id]/portal-actions'

export function CopyPortalLinkButton({ customerId }: { customerId: string }) {
  const [copied, setCopied]   = useState(false)
  const [error,  setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      setError(null)
      const result = await getOrCreatePortalToken(customerId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      const url = `${window.location.origin}/portal/${result.token}`
      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        // Fallback: open in new tab so they can copy manually
        window.open(url, '_blank')
      }
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="btn btn-secondary btn-sm"
      >
        {isPending ? 'Generating…' : copied ? '✓ Link Copied!' : '🔗 Share Portal Link'}
      </button>
      {error && <div className="alert alert-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  )
}
