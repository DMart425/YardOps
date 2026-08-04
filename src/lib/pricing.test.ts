import { describe, it, expect } from 'vitest'
import {
  calculateEstimate,
  formatMinutes,
  acrestoMowMinutes,
  estimateMowableAcres,
  type EstimateInputs,
} from './pricing'

// A plain weekly mow: 10 setup + 45 mowing, no extras, default $65/hr.
const BASE_INPUTS: EstimateInputs = {
  mowingMinutes: 45,
  setupMinutes: 10,
  weedEatingLevel: 'none',
  edgingLevel: 'none',
  blowOffLevel: 'none',
  grassCondition: 'maintained',
  terrain: 'flat',
  frequency: 'weekly',
  obstacles: [],
  customObstacleMinutes: 0,
  baggingLevel: 'none',
  haulOffLevel: 'none',
  haulOffCustom: 0,
  leafCleanupLevel: 'none',
  leafCleanupCustom: 0,
  shrubSmallCount: 0,
  shrubMediumCount: 0,
  shrubLargeCount: 0,
  stickPickupLevel: 'none',
  travelFee: 0,
  hourlyRate: 65,
}

describe('calculateEstimate', () => {
  it('computes a plain weekly mow (55 min → $59.58 labor → $60 rounded)', () => {
    const r = calculateEstimate(BASE_INPUTS)
    expect(r.breakdown.baseLaborMinutes).toBe(55)
    expect(r.totalMinutes).toBe(55)
    expect(r.breakdown.laborPrice).toBe(59.58)
    expect(r.breakdown.minimumApplied).toBe(false)
    expect(r.finalEstimate).toBe(60) // rounded up to nearest $5
  })

  it('enforces the minimum service price', () => {
    const r = calculateEstimate({ ...BASE_INPUTS, mowingMinutes: 10, setupMinutes: 5 })
    expect(r.breakdown.minimumApplied).toBe(true)
    expect(r.finalEstimate).toBe(55) // DEFAULT_SETTINGS.minimumServicePrice
  })

  it('applies grass and frequency multipliers', () => {
    // 55 min × 1.5 overgrown = 82.5 min → $89.375 labor × 1.15 biweekly = $102.78 → $105
    const r = calculateEstimate({ ...BASE_INPUTS, grassCondition: 'overgrown', frequency: 'biweekly' })
    expect(r.breakdown.frequencyMultiplier).toBe(1.15)
    expect(r.finalEstimate).toBe(105)
  })

  it('adds obstacles and add-ons into the total', () => {
    const r = calculateEstimate({
      ...BASE_INPUTS,
      obstacles: ['fence_line', 'ditch'], // 10 + 15 min
      baggingLevel: 'normal',             // $50
      shrubSmallCount: 2,                 // 2 × $15
    })
    expect(r.breakdown.obstacleMinutes).toBe(25)
    expect(r.breakdown.addOnsTotal).toBe(80)
  })

  it('treats unknown level keys as zero instead of crashing', () => {
    const r = calculateEstimate({ ...BASE_INPUTS, weedEatingLevel: 'bogus', terrain: 'bogus' })
    expect(r.breakdown.weedEatingMinutes).toBe(0)
    expect(r.finalEstimate).toBe(60) // unchanged from base
  })

  // Regression: legacy estimate_inputs may omit custom amounts entirely.
  // An undefined here used to poison the whole estimate with NaN.
  it('never produces NaN when custom amounts are missing (legacy inputs)', () => {
    const legacy = {
      ...BASE_INPUTS,
      haulOffLevel: 'large',
      leafCleanupLevel: 'custom',
      haulOffCustom: undefined,
      leafCleanupCustom: undefined,
      shrubSmallCount: undefined,
    } as unknown as EstimateInputs
    const r = calculateEstimate(legacy)
    expect(Number.isFinite(r.finalEstimate)).toBe(true)
    expect(r.breakdown.addOnsTotal).toBe(0)
  })
})

describe('formatMinutes', () => {
  it('formats minutes, whole hours, and mixed durations', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 hr')
    expect(formatMinutes(125)).toBe('2 hr 5 min')
  })
})

describe('acrestoMowMinutes', () => {
  it('picks the closest tier at or below the acreage', () => {
    expect(acrestoMowMinutes(0.5)).toBe(45)
    expect(acrestoMowMinutes(0.6)).toBe(45)  // between tiers → lower tier
    expect(acrestoMowMinutes(0.1)).toBe(25)  // below the smallest tier
    expect(acrestoMowMinutes(10)).toBe(375)  // beyond the largest tier
  })
})

describe('estimateMowableAcres', () => {
  it('applies the vacant-land factor', () => {
    expect(estimateMowableAcres(1, 0, 'Vacant land')).toBe(0.9)
  })
  it('applies tiered factors for improved lots', () => {
    expect(estimateMowableAcres(0.2)).toBe(0.11)   // < 0.25 open → 0.55
    expect(estimateMowableAcres(2, 1.5)).toBe(0.35) // 0.5 open after timber → 0.70
  })
  it('never goes negative when timber exceeds total', () => {
    expect(estimateMowableAcres(1, 2)).toBe(0)
  })
})
