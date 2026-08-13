'use client'

import { useState } from 'react'
import { buildSmsHref, buildGoogleVoiceThreadUrl, buildGoogleVoiceIntentUrl, isAndroidUserAgent, type SmsMode } from '@/lib/sms'

// On Android, an intent:// URL launches the Google Voice APP directly
// (with the web thread as automatic fallback if it's not installed).
// Elsewhere, the web thread opens in a new tab. Navigation must be
// same-tab for intent URLs — window.open of intent:// gets blocked.
function openGoogleVoice(phone: string) {
  if (isAndroidUserAgent(navigator.userAgent)) {
    window.location.href = buildGoogleVoiceIntentUrl(phone)
  } else {
    window.open(buildGoogleVoiceThreadUrl(phone), '_blank', 'noopener')
  }
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

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (body) {
      try {
        await navigator.clipboard.writeText(body)
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch {
        // Clipboard can fail outside a secure context — GV still opens;
        // the operator just retypes or long-press-pastes from the app.
      }
    }
    openGoogleVoice(phone)
  }

  return (
    <a href={gvUrl} onClick={handleClick} className={className} style={style} title={body ? 'Copies the message, then opens Google Voice — paste and send' : 'Opens Google Voice'}>
      {copied ? '✓ Copied — paste in Voice' : children}
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
  navigator.clipboard.writeText(body).catch(() => {})
  openGoogleVoice(phone)
}
