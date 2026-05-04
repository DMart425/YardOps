'use client'

import { useEffect, useRef, useState } from 'react'

export function Toast({ message, triggerKey }: { message?: string | null; triggerKey?: number | null }) {
  const [visible, setVisible] = useState(false)
  const prevMessage = useRef<string | null>(null)

  useEffect(() => {
    // triggerKey mode: fires every time triggerKey changes (even same message)
    if (triggerKey !== undefined && triggerKey !== null) {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), 3500)
      return () => clearTimeout(t)
    }
    // fallback: fires when message first appears or changes to a new value
    if (!message || message === prevMessage.current) return
    prevMessage.current = message
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(t)
  }, [message, triggerKey])

  if (!visible || !message) return null

  return <div className="toast toast-success">{message}</div>
}
