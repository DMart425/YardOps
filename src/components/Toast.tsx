'use client'

import { useEffect, useState } from 'react'

export function Toast({ message }: { message?: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(t)
  }, [message])

  if (!visible || !message) return null

  return <div className="toast toast-success">{message}</div>
}
