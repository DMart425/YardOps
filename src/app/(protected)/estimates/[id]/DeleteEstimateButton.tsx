'use client'

import { deleteEstimate } from './actions'

export default function DeleteEstimateButton({ estimateId }: { estimateId: string }) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm('Delete this estimate? This cannot be undone.')) e.preventDefault()
  }
  return (
    <form action={deleteEstimate.bind(null, estimateId)} onSubmit={handleSubmit} style={{ marginTop: '12px' }}>
      <button type="submit" className="btn btn-sm" style={{ background: 'var(--color-danger, #ef4444)', color: '#fff', border: 'none', width: '100%' }}>
        Delete Estimate
      </button>
    </form>
  )
}
