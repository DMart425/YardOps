'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Toast } from '@/components/Toast'

export default function SavedToast() {
  const params = useSearchParams()
  const saved = params.get('saved') === '1'

  useEffect(() => {
    if (!saved) return
    // Remove ?saved=1 from the URL without a re-render
    const url = new URL(window.location.href)
    url.searchParams.delete('saved')
    window.history.replaceState(null, '', url.pathname + (url.search || ''))
  }, [saved])

  return <Toast message={saved ? 'Changes saved' : null} />
}
