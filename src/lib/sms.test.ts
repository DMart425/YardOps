import { describe, it, expect } from 'vitest'
import { resolveSmsMode, toE164Us, buildSmsHref, buildGoogleVoiceThreadUrl, isAndroidUserAgent } from './sms'

describe('resolveSmsMode', () => {
  it('defaults to device for null/unknown values', () => {
    expect(resolveSmsMode(null)).toBe('device')
    expect(resolveSmsMode(undefined)).toBe('device')
    expect(resolveSmsMode('device')).toBe('device')
    expect(resolveSmsMode('imessage')).toBe('device')
  })
  it('recognizes google_voice', () => {
    expect(resolveSmsMode('google_voice')).toBe('google_voice')
  })
})

describe('toE164Us', () => {
  it('normalizes formatted and bare 10-digit numbers', () => {
    expect(toE164Us('(334) 555-0100')).toBe('+13345550100')
    expect(toE164Us('334-555-0100')).toBe('+13345550100')
    expect(toE164Us('3345550100')).toBe('+13345550100')
  })
  it('handles a leading country code', () => {
    expect(toE164Us('13345550100')).toBe('+13345550100')
    expect(toE164Us('+1 334 555 0100')).toBe('+13345550100')
  })
  it('returns null for non-US shapes', () => {
    expect(toE164Us('555-0100')).toBeNull()
    expect(toE164Us('')).toBeNull()
  })
})

describe('buildSmsHref', () => {
  it('builds a body-less link', () => {
    expect(buildSmsHref('3345550100')).toBe('sms:3345550100')
  })
  it('encodes the body', () => {
    expect(buildSmsHref('3345550100', 'Hi & thanks')).toBe('sms:3345550100?&body=Hi%20%26%20thanks')
  })
})

describe('isAndroidUserAgent', () => {
  it('detects Android user agents', () => {
    expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S921U)')).toBe(true)
    expect(isAndroidUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe(false)
  })
})

describe('buildGoogleVoiceThreadUrl', () => {
  it('builds a thread URL with the encoded E.164 itemId', () => {
    expect(buildGoogleVoiceThreadUrl('(334) 555-0100')).toBe(
      'https://voice.google.com/u/0/messages?itemId=t.%2B13345550100'
    )
  })
  it('falls back to the messages list for unparseable numbers', () => {
    expect(buildGoogleVoiceThreadUrl('555')).toBe('https://voice.google.com/u/0/messages')
  })
})
