'use client'

import { useState, useTransition } from 'react'
import { getOrCreatePortalToken, regeneratePortalToken } from '@/app/(protected)/customers/[id]/portal-actions'

export function CopyPortalLinkButton({ customerId }: { customerId: string }) {
  const [copied, setCopied]   = useState<'copied' | 'regenerated' | null>(null)
  const [error,  setError]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function copyUrl(token: string, label: 'copied' | 'regenerated') {
    const url = `${window.location.origin}/portal/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(label)
      setTimeout(() => setCopied(null), 3000)
    } catch {
      // Fallback: open in new tab so they can copy manually
      window.open(url, '_blank')
    }
  }

  function handleClick() {
    startTransition(async () => {
      setError(null)
      const result = await getOrCreatePortalToken(customerId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      await copyUrl(result.token, 'copied')
    })
  }

  function handleRegenerate() {
    if (!window.confirm('Regenerate the portal link? The old link stops working immediately — anyone holding it loses access.')) return
    startTransition(async () => {
      setError(null)
      const result = await regeneratePortalToken(customerId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      await copyUrl(result.token, 'regenerated')
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="btn btn-secondary btn-sm"
        >
          {isPending ? 'Working…' : copied === 'copied' ? '✓ Link Copied!' : '🔗 Share Portal Link'}
        </button>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isPending}
          className="btn btn-secondary btn-sm"
          title="Invalidate the current link and copy a fresh one"
        >
          {copied === 'regenerated' ? '✓ New Link Copied!' : '↻ Regenerate Link'}
        </button>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  )
}
