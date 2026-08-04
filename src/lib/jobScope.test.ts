import { describe, it, expect } from 'vitest'
import {
  parseJobInputs,
  formatCoreServicesForCustomer,
  formatAddonsForCustomer,
  resolveServiceLabel,
  buildDefaultCompletionNotes,
} from './jobScope'

const FULL_INPUTS = {
  svcMowing: true,
  svcWeedEating: true,
  svcEdging: true,
  svcBlowOff: true,
  baggingLevel: 'basic',
  stickPickupLevel: 'none',
  leafCleanupLevel: 'full',
  haulOffLevel: 'none',
  shrubSmallCount: 2,
  shrubMediumCount: 1,
  shrubLargeCount: 0,
}

describe('parseJobInputs', () => {
  it('returns null for null, arrays, and objects without the svcMowing marker', () => {
    expect(parseJobInputs(null)).toBeNull()
    expect(parseJobInputs(undefined)).toBeNull()
    expect(parseJobInputs([] as unknown as Record<string, unknown>)).toBeNull()
    expect(parseJobInputs({ somethingElse: true })).toBeNull()
  })
  it('parses a full shape', () => {
    expect(parseJobInputs(FULL_INPUTS)).toEqual(FULL_INPUTS)
  })
  it('defaults missing fields safely (marker present)', () => {
    const parsed = parseJobInputs({ svcMowing: true })
    expect(parsed).toMatchObject({
      svcMowing: true,
      svcWeedEating: false,
      baggingLevel: 'none',
      shrubSmallCount: 0,
    })
  })
  it('coerces wrong-typed fields to safe defaults', () => {
    const parsed = parseJobInputs({ svcMowing: 1, baggingLevel: 42, shrubSmallCount: 'two' })
    expect(parsed).toMatchObject({ svcMowing: true, baggingLevel: 'none', shrubSmallCount: 0 })
  })
})

describe('formatCoreServicesForCustomer', () => {
  it('joins selected core services', () => {
    expect(formatCoreServicesForCustomer(parseJobInputs(FULL_INPUTS)!)).toBe(
      'Mowing, Weed eating, Edging, Blow off'
    )
  })
  it('returns null when nothing is selected', () => {
    expect(formatCoreServicesForCustomer(parseJobInputs({ svcMowing: false })!)).toBeNull()
  })
})

describe('formatAddonsForCustomer', () => {
  // Durable rule: no internal level detail (light/basic/full) in customer labels.
  it('lists add-ons without level detail and totals shrubs', () => {
    expect(formatAddonsForCustomer(parseJobInputs(FULL_INPUTS)!)).toBe(
      'Bagging clippings, Leaf cleanup, Shrub trimming (3)'
    )
  })
  // Durable rule: no add-ons row when all levels are none and counts are 0.
  it('returns null when all add-ons are none/zero', () => {
    expect(formatAddonsForCustomer(parseJobInputs({ svcMowing: true })!)).toBeNull()
  })
})

describe('resolveServiceLabel', () => {
  it('prefers job_inputs over service_package and title', () => {
    expect(resolveServiceLabel({ svcMowing: true, svcEdging: true }, 'full_service', 'A Title')).toBe(
      'Mowing, Edging'
    )
  })
  it('falls back to the service_package label map', () => {
    expect(resolveServiceLabel(null, 'mow_trim_blow', 'A Title')).toBe('Mow, Trim & Blow')
  })
  it('capitalizes unknown package codes', () => {
    expect(resolveServiceLabel(null, 'mow_blow', null)).toBe('Mow Blow')
  })
  it('falls back to title, then the ultimate default', () => {
    expect(resolveServiceLabel(null, null, 'Custom Job')).toBe('Custom Job')
    expect(resolveServiceLabel(null, null, null)).toBe('Lawn Service')
  })
})

describe('buildDefaultCompletionNotes', () => {
  it('builds a past-tense summary from job_inputs', () => {
    expect(buildDefaultCompletionNotes(FULL_INPUTS, null)).toBe(
      'Mowed, weed ate, edged, blew off, bagged clippings, cleaned up leaves, trimmed shrubs'
    )
  })
  it('falls through to service_package when job_inputs has nothing selected', () => {
    expect(buildDefaultCompletionNotes({ svcMowing: false }, 'mow_trim_blow')).toBe(
      'Mowed, weed ate, blew off'
    )
  })
  it('uses the ultimate fallback when nothing is available', () => {
    expect(buildDefaultCompletionNotes(null, null)).toBe('Lawn service completed')
    expect(buildDefaultCompletionNotes(null, 'unknown_pkg')).toBe('Lawn service completed')
  })
})
