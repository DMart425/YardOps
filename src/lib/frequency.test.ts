import { describe, it, expect } from 'vitest'
import { normalizeFrequency, formatFrequencyLabel, parseWebsiteServiceInterests } from './frequency'

describe('normalizeFrequency', () => {
  it('maps canonical and variant inputs', () => {
    expect(normalizeFrequency('weekly')).toBe('weekly')
    expect(normalizeFrequency(' WEEKLY ')).toBe('weekly')
    expect(normalizeFrequency('biweekly')).toBe('biweekly')
    expect(normalizeFrequency('Bi-Weekly')).toBe('biweekly')
    expect(normalizeFrequency('bi weekly')).toBe('biweekly')
    expect(normalizeFrequency('one_time')).toBe('one_time')
    expect(normalizeFrequency('one-time cut')).toBe('one_time')
    expect(normalizeFrequency('custom')).toBe('custom')
    expect(normalizeFrequency('paused')).toBe('paused')
  })

  // Durable rule: 'unsure' must fail safe to null — never default to weekly.
  it("fails 'unsure' safe to null (never weekly)", () => {
    expect(normalizeFrequency('unsure')).toBeNull()
    expect(normalizeFrequency('not sure yet')).toBeNull()
    expect(normalizeFrequency('not sure')).toBeNull()
  })

  it('fails unknown and empty inputs safe to null', () => {
    expect(normalizeFrequency('monthly')).toBeNull()
    expect(normalizeFrequency('')).toBeNull()
    expect(normalizeFrequency(null)).toBeNull()
    expect(normalizeFrequency(undefined)).toBeNull()
  })
})

describe('formatFrequencyLabel', () => {
  it('formats canonical values', () => {
    expect(formatFrequencyLabel('weekly')).toBe('Weekly')
    expect(formatFrequencyLabel('biweekly')).toBe('Bi-weekly')
    expect(formatFrequencyLabel('one_time')).toBe('One-time')
    expect(formatFrequencyLabel('unsure')).toBe('Not sure yet')
  })
  it('handles empty and unknown values', () => {
    expect(formatFrequencyLabel(null)).toBe('Not specified')
    expect(formatFrequencyLabel('every_10_days')).toBe('every 10 days')
  })
})

describe('parseWebsiteServiceInterests', () => {
  it('parses a structured interests block', () => {
    const notes = 'Some intro\nWebsite service interests:\n- mowing\n- weed_eating\n- edging'
    expect(Array.from(parseWebsiteServiceInterests(notes))).toEqual(['mowing', 'weed_eating', 'edging'])
  })
  it('stops at the next non-list section', () => {
    const notes = 'Website service interests:\n- mowing\nOther notes:\n- not_an_interest'
    expect(Array.from(parseWebsiteServiceInterests(notes))).toEqual(['mowing'])
  })
  it('returns an empty set for null or unrelated notes', () => {
    expect(parseWebsiteServiceInterests(null).size).toBe(0)
    expect(parseWebsiteServiceInterests('just a plain note').size).toBe(0)
  })
})
