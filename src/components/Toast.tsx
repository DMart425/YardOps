'use client'

import { useEffect, useRef, useState } from 'react'

export function Toast({ message, triggerKey }: { message?: string | null; triggerKey?: number | null }) {
  const [visible, setVisible] = useState(false)
  const prevMessage = useRef<string | null>(null)

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleToast = () => {
      // Defer the "show" transition so we avoid synchronous setState in effect.
      showTimer = setTimeout(() => setVisible(true), 0)
      hideTimer = setTimeout(() => setVisible(false), 3500)
    }

    // triggerKey mode: fires every time triggerKey changes (even same message)
    if (triggerKey !== undefined && triggerKey !== null) {
      scheduleToast()
      return () => {
        if (showTimer) clearTimeout(showTimer)
        if (hideTimer) clearTimeout(hideTimer)
      }
    }

    // fallback: fires when message first appears or changes to a new value
    if (!message || message === prevMessage.current) {
      return () => {
        if (showTimer) clearTimeout(showTimer)
        if (hideTimer) clearTimeout(hideTimer)
      }
    }

    prevMessage.current = message
    scheduleToast()

    return () => {
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [message, triggerKey])

  if (!visible || !message) return null

  return <div className="toast toast-success">{message}</div>
}
