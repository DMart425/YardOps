// SMS handoff helpers — pure TypeScript, no React.
//
// The operator's business number lives on Google Voice, which sms: deep
// links cannot reach: Android offers no app chooser for GV and Google
// provides no compose deep link (no URL accepts recipient + body). The
// closest reliable handoff is GV's per-number thread URL — so google_voice
// mode copies the composed body to the clipboard and opens the customer's
// thread to paste into. device mode is the original one-tap sms: link.

export type SmsMode = 'device' | 'google_voice'

export function resolveSmsMode(raw: string | null | undefined): SmsMode {
  return raw === 'google_voice' ? 'google_voice' : 'device'
}

/**
 * Normalizes a US phone string ("(334) 555-0100", "334-555-0100",
 * "13345550100") to +1XXXXXXXXXX for Google Voice thread URLs.
 * Returns null when the digits don't form a US number.
 */
export function toE164Us(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/** sms: deep link for the device's default messaging app. */
export function buildSmsHref(phone: string, body?: string | null): string {
  return body ? `sms:${phone}?&body=${encodeURIComponent(body)}` : `sms:${phone}`
}

/**
 * Google Voice web URL for the conversation thread with this number.
 * Opens (or starts) the thread; the message body cannot be prefilled —
 * callers copy it to the clipboard first. Falls back to the GV messages
 * list when the phone number can't be normalized.
 */
export function buildGoogleVoiceThreadUrl(phone: string): string {
  const e164 = toE164Us(phone)
  if (!e164) return 'https://voice.google.com/u/0/messages'
  return `https://voice.google.com/u/0/messages?itemId=${encodeURIComponent(`t.${e164}`)}`
}

// Field-verified dead ends (2026-08-12) — do NOT retry these:
// - VIEW intent:// to voice.google.com URLs: the GV app registers no intent
//   filters for its own web URLs; falls through to a (possibly logged-out)
//   browser tab.
// - MAIN/LAUNCHER intent://: Chromium sanitizes intent URIs to
//   BROWSABLE-only resolution; GV has no browsable activities. Falls through.
// - Web GV on mobile: drops the ?itemId thread param (lands on Calls) and
//   renders a desktop-only layout. Unusable on phones; acceptable on desktop.
// The share sheet (navigator.share with the message text) is the ONLY
// reliable web → GV-app handoff, and GV pre-fills the shared text.

/** True when the user agent is an Android browser (intent:// supported). */
export function isAndroidUserAgent(userAgent: string): boolean {
  return /android/i.test(userAgent)
}
