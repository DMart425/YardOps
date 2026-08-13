'use client'

import { useState } from 'react'
import { buildSmsHref, buildGoogleVoiceThreadUrl, buildGoogleVoiceAppLaunchUrl, isAndroidUserAgent, type SmsMode } from '@/lib/sms'

// Google Voice handoff (field-tested 2026-08-12):
// - With a composed body, the SHARE SHEET is the best path — the GV app
//   accepts shared text pre-filled into a new message, no pasting. The body
//   also goes to the clipboard as backup. If the share sheet is unavailable
//   (desktop), fall through to the app-launch/web path.
// - Bare "text this customer" links (no body) launch the GV app via its
//   launcher activity on Android (GV registers NO intent filters for its own
//   web URLs — a VIEW intent falls through to a logged-out browser), or the
//   web thread elsewhere.
// Must run synchronously inside the click gesture — share/intent launches
// are blocked without one.
function launchGoogleVoice(phone: string, body?: string | null): 'shared' | 'opened' {
  if (body) {
    navigator.clipboard?.writeText(body).catch(() => {})
    if (typeof navigator.share === 'function') {
      navigator.share({ text: body }).catch(() => {
        // Share canceled or failed — the body is on the clipboard either way.
      })
      return 'shared'
    }
  }
  if (isAndroidUserAgent(navigator.userAgent)) {
    window.location.href = buildGoogleVoiceAppLaunchUrl(phone)
  } else {
    window.open(buildGoogleVoiceThreadUrl(phone), '_blank', 'noopener')
  }
  return 'opened'
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
    const result = launchGoogleVoice(phone, body)
    if (body) {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
    void result
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
