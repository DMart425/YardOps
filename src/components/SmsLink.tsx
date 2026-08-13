'use client'

import { useState } from 'react'
import { buildSmsHref, buildGoogleVoiceThreadUrl, isAndroidUserAgent, type SmsMode } from '@/lib/sms'

// Google Voice handoff (field-tested 2026-08-12 — see dead-end notes in
// lib/sms.ts): the share sheet is the ONLY reliable path into the GV app,
// and it pre-fills the shared text into a new message. Every GV-mode button
// therefore carries a body (bare "Text" buttons pass a starter greeting).
// The body also goes to the clipboard as backup. Desktop (no share sheet)
// opens the web thread, which works properly on desktop layouts.
// Must run synchronously inside the click gesture — share is blocked
// without one.
function launchGoogleVoice(phone: string, body?: string | null): void {
  if (body) {
    navigator.clipboard?.writeText(body).catch(() => {})
    if (typeof navigator.share === 'function' && isAndroidUserAgent(navigator.userAgent)) {
      navigator.share({ text: body }).catch(() => {
        // Share canceled or failed — the body is on the clipboard either way.
      })
      return
    }
  }
  window.open(buildGoogleVoiceThreadUrl(phone), '_blank', 'noopener')
}

/**
 * Launches an outgoing text per the operator's SMS mode. Programmatic
 * counterpart for auto-launch flows lives in launchSms below.
 *
 * device       → sms: deep link (one tap into the default messaging app)
 * google_voice → copy the body to the clipboard, then open the customer's
 *                Google Voice thread in a new tab to paste into (GV has no
 *                compose deep link — this is the closest reliable handoff)
 */
export function SmsLink({
  phone,
  body,
  mode,
  className,
  style,
  children,
}: {
  phone: string
  body?: string | null
  mode: SmsMode
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)

  if (mode !== 'google_voice') {
    return (
      <a href={buildSmsHref(phone, body)} className={className} style={style}>
        {children}
      </a>
    )
  }

  const gvUrl = buildGoogleVoiceThreadUrl(phone)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    launchGoogleVoice(phone, body)
    if (body) {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  return (
    <a href={gvUrl} onClick={handleClick} className={className} style={style} title={body ? 'Opens the share menu — choose Google Voice (message is also copied)' : 'Opens Google Voice'}>
      {copied ? '✓ Sent to share menu' : children}
    </a>
  )
}

/**
 * Programmatic launch for flows that fire after a form submit (invoice SMS
 * after completion, receipt after payment). In google_voice mode the copy +
 * open runs best-effort — callers should keep a visible SmsLink fallback
 * rendered, since popup blockers can eat window.open outside a user gesture.
 */
export function launchSms(phone: string, body: string, mode: SmsMode) {
  if (mode !== 'google_voice') {
    window.location.href = buildSmsHref(phone, body)
    return
  }
  launchGoogleVoice(phone, body)
}
