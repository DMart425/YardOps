import { describe, it, expect } from 'vitest'
import {
  resolveTimeZone,
  getLocalDateStr,
  addDays,
  localMidnightUtcIso,
  localDateEndUtc,
  getLocalMonthKey,
  getClosestWeekdayNearDate,
} from './date'

describe('resolveTimeZone', () => {
  it('returns valid timezones unchanged', () => {
    expect(resolveTimeZone('America/Chicago')).toBe('America/Chicago')
  })
  it('falls back to UTC for null, undefined, and garbage', () => {
    expect(resolveTimeZone(null)).toBe('UTC')
    expect(resolveTimeZone(undefined)).toBe('UTC')
    expect(resolveTimeZone('Not/AZone')).toBe('UTC')
  })
})

describe('getLocalDateStr', () => {
  it('returns the local calendar date for a UTC instant', () => {
    // 23:30Z Aug 3 = 18:30 CDT Aug 3
    expect(getLocalDateStr('America/Chicago', new Date('2026-08-03T23:30:00Z'))).toBe('2026-08-03')
  })
  it('handles the late-evening rollover (early-morning UTC next day)', () => {
    // 03:30Z Aug 4 = 22:30 CDT Aug 3 — still Aug 3 locally
    expect(getLocalDateStr('America/Chicago', new Date('2026-08-04T03:30:00Z'))).toBe('2026-08-03')
  })
})

describe('addDays', () => {
  it('adds and subtracts across month and year boundaries', () => {
    expect(addDays('2026-08-03', 1)).toBe('2026-08-04')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-08-03', 0)).toBe('2026-08-03')
  })
})

describe('localMidnightUtcIso', () => {
  it('matches the documented CDT example', () => {
    expect(localMidnightUtcIso('2026-06-07', 'America/Chicago')).toBe('2026-06-07T05:00:00.000Z')
  })
  it('handles standard time (CST, UTC-6)', () => {
    expect(localMidnightUtcIso('2026-01-15', 'America/Chicago')).toBe('2026-01-15T06:00:00.000Z')
  })
  it('is identity for UTC', () => {
    expect(localMidnightUtcIso('2026-08-03', 'UTC')).toBe('2026-08-03T00:00:00.000Z')
  })
  it('handles UTC+ timezones (local midnight is before UTC midnight)', () => {
    // Tokyo is UTC+9: midnight Aug 3 JST = 15:00Z Aug 2
    expect(localMidnightUtcIso('2026-08-03', 'Asia/Tokyo')).toBe('2026-08-02T15:00:00.000Z')
  })
})

describe('localDateEndUtc', () => {
  it('returns midnight at the start of the following local day', () => {
    expect(localDateEndUtc('2026-08-03', 'America/Chicago').toISOString()).toBe('2026-08-04T05:00:00.000Z')
    expect(localDateEndUtc('2026-08-03', 'UTC').toISOString()).toBe('2026-08-04T00:00:00.000Z')
  })
  it('an instant late on the valid day is before the cutoff; the next morning is after', () => {
    const cutoff = localDateEndUtc('2026-08-03', 'America/Chicago')
    expect(new Date('2026-08-04T04:59:00Z') < cutoff).toBe(true)  // 11:59 PM CDT Aug 3
    expect(new Date('2026-08-04T05:01:00Z') < cutoff).toBe(false) // 12:01 AM CDT Aug 4
  })
})

describe('getLocalMonthKey', () => {
  it('buckets by local month, not UTC month', () => {
    // 03:30Z Sep 1 = Aug 31 evening in Chicago
    expect(getLocalMonthKey('2026-09-01T03:30:00Z', 'America/Chicago')).toBe('2026-08')
  })
})

describe('getClosestWeekdayNearDate', () => {
  // 2026-08-03 is a Monday, 2026-08-05 is a Wednesday.
  it('returns startDate unchanged when already on the target weekday', () => {
    expect(getClosestWeekdayNearDate('2026-08-03', 'monday')).toBe('2026-08-03')
  })
  it('snaps BACKWARD when the backward candidate is closer (regression: not forward-only)', () => {
    // Wed → Monday: back 2 days (within ±4), forward 5 days (outside)
    expect(getClosestWeekdayNearDate('2026-08-05', 'monday')).toBe('2026-08-03')
  })
  it('snaps forward when the forward candidate is closer', () => {
    // Wed → Friday: forward 2 days
    expect(getClosestWeekdayNearDate('2026-08-05', 'friday')).toBe('2026-08-07')
  })
  it('prefers the closer candidate when both directions qualify', () => {
    // Wed → Sunday: back 3 vs forward 4 — back wins
    expect(getClosestWeekdayNearDate('2026-08-05', 'sunday')).toBe('2026-08-02')
  })
  it('excludes backward candidates before minDate and falls forward when in range', () => {
    // Wed → Sunday with minDate blocking the backward Sunday: forward 4 still within ±4
    expect(getClosestWeekdayNearDate('2026-08-05', 'sunday', { minDate: '2026-08-03' })).toBe('2026-08-09')
  })
  it('returns startDate unchanged when no candidate is within maxDays (caller suppresses chip)', () => {
    // Wed → Monday with backward blocked: forward 5 > maxDays 4 → unchanged
    expect(getClosestWeekdayNearDate('2026-08-05', 'monday', { minDate: '2026-08-04' })).toBe('2026-08-05')
  })
  it('returns startDate unchanged for unrecognized weekday strings', () => {
    expect(getClosestWeekdayNearDate('2026-08-05', 'someday')).toBe('2026-08-05')
  })
})
