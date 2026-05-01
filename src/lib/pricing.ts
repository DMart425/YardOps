// ─────────────────────────────────────────────────────────────────────────────
// pricing.ts — Wicksburg Lawn Service estimate calculation engine
// All business logic lives here so defaults can be changed without touching UI.
// ─────────────────────────────────────────────────────────────────────────────

// ── Default settings ──────────────────────────────────────────────────────────

export interface PricingSettings {
  targetHourlyRate: number
  minimumServicePrice: number
  roundToNearest: number
  defaultSetupMinutes: number

  mowingMinutesBySize: Record<string, number>

  weedEatingMinutes: Record<string, number>
  edgingMinutes: Record<string, number>
  blowOffMinutes: Record<string, number>

  grassConditionMultipliers: Record<string, number>
  terrainMultipliers: Record<string, number>
  frequencyMultipliers: Record<string, number>

  obstacleMinutes: Record<string, number>

  addOnPrices: {
    bagging: Record<string, number>
    haulOff: Record<string, number>
    leafCleanup: Record<string, number>
    shrubSmall: number
    shrubMedium: number
    shrubLarge: number
    stickPickup: Record<string, number>
  }

  travelFeeDefault: number
  travelFeeOutsideArea: number
}

export const DEFAULT_SETTINGS: PricingSettings = {
  targetHourlyRate:     65,
  minimumServicePrice:  55,
  roundToNearest:        5,
  defaultSetupMinutes:  10,

  mowingMinutesBySize: {
    '0.25':  25,
    '0.5':   45,
    '0.75':  65,
    '1.0':   75,
    '1.5':  115,
    '2.0':  150,
    '3.0':  225,
    '5.0':  375,
  },

  weedEatingMinutes: {
    none:       0,
    light:     10,
    normal:    20,
    heavy:     35,
    very_heavy: 50,
  },

  edgingMinutes: {
    none:       0,
    light:      5,
    normal:    10,
    heavy:     20,
    very_heavy: 30,
  },

  blowOffMinutes: {
    none:         0,
    basic:        5,
    normal:      10,
    large_area:  15,
    heavy_cleanup: 25,
  },

  grassConditionMultipliers: {
    maintained:         1.0,
    slightly_tall:      1.15,
    overgrown:          1.5,
    severely_overgrown: 2.0,
  },

  terrainMultipliers: {
    flat:           1.0,
    slight_slope:   1.1,
    ditches:        1.2,
    difficult:      1.35,
  },

  frequencyMultipliers: {
    weekly:   1.0,
    biweekly: 1.15,
    one_time: 1.35,
    monthly:  1.5,
  },

  obstacleMinutes: {
    fence_line:          10,
    many_trees:          10,
    playset_trampoline:   5,
    sheds_outbuildings:   5,
    flower_beds:         10,
    tight_gate:           5,
    pool_area:           10,
    ditch:               15,
  },

  addOnPrices: {
    bagging:    { none: 0, light: 25, normal: 50, heavy: 75 },
    haulOff:    { none: 0, small: 50, medium: 100 },
    leafCleanup: { none: 0, small: 75, medium: 150, large: 250 },
    shrubSmall:   15,
    shrubMedium:  25,
    shrubLarge:   40,
    stickPickup: { none: 0, light: 25, normal: 50, heavy: 100 },
  },

  travelFeeDefault:     0,
  travelFeeOutsideArea: 15,
}

// ── Input / Output types ──────────────────────────────────────────────────────

export interface EstimateInputs {
  // Property
  mowingMinutes:    number   // can be auto-suggested or custom
  setupMinutes:     number

  // Task levels
  weedEatingLevel:  string
  edgingLevel:      string
  blowOffLevel:     string

  // Condition / terrain
  grassCondition:   string
  terrain:          string

  // Frequency
  frequency:        string

  // Obstacles — array of keys from obstacleMinutes
  obstacles:        string[]
  customObstacleMinutes: number

  // Add-ons
  baggingLevel:     string
  haulOffLevel:     string
  haulOffCustom:    number
  leafCleanupLevel: string
  leafCleanupCustom: number
  shrubSmallCount:  number
  shrubMediumCount: number
  shrubLargeCount:  number
  stickPickupLevel: string

  // Travel
  travelFee:        number

  // Rate override (from settings by default)
  hourlyRate:       number
}

export interface EstimateBreakdown {
  setupMinutes:          number
  mowingMinutes:         number
  weedEatingMinutes:     number
  edgingMinutes:         number
  blowOffMinutes:        number
  obstacleMinutes:       number
  baseLaborMinutes:      number
  grassAdjustedMinutes:  number
  terrainAdjustedMinutes: number
  estimatedHours:        number
  laborPrice:            number
  frequencyMultiplier:   number
  frequencyAdjustedPrice: number
  addOnsTotal:           number
  travelFee:             number
  subtotalBeforeMinimum: number
  minimumApplied:        boolean
  finalEstimate:         number
}

export interface EstimateResult {
  breakdown:      EstimateBreakdown
  totalMinutes:   number
  finalEstimate:  number
  lineItems: {
    label:       string
    minutes?:    number
    price?:      number
    isAddOn?:    boolean
  }[]
}

// ── Core calculation ───────────────────────────────────────────────────────────

export function calculateEstimate(
  inputs: EstimateInputs,
  settings: PricingSettings = DEFAULT_SETTINGS,
): EstimateResult {
  const {
    targetHourlyRate, minimumServicePrice, roundToNearest,
    weedEatingMinutes, edgingMinutes, blowOffMinutes,
    grassConditionMultipliers, terrainMultipliers, frequencyMultipliers,
    obstacleMinutes: obstacleMap, addOnPrices,
  } = settings

  const rate = inputs.hourlyRate ?? targetHourlyRate

  // Step 1: base labor minutes
  const weMin    = weedEatingMinutes[inputs.weedEatingLevel]  ?? 0
  const edMin    = edgingMinutes[inputs.edgingLevel]          ?? 0
  const boMin    = blowOffMinutes[inputs.blowOffLevel]        ?? 0
  const obsMin   = inputs.obstacles.reduce((s, k) => s + (obstacleMap[k] ?? 0), 0)
               + (inputs.customObstacleMinutes || 0)

  const baseLaborMinutes = inputs.setupMinutes + inputs.mowingMinutes + weMin + edMin + boMin + obsMin

  // Step 2: grass condition multiplier
  const grassMult  = grassConditionMultipliers[inputs.grassCondition] ?? 1.0
  const grassAdj   = baseLaborMinutes * grassMult

  // Step 3: terrain multiplier
  const terrainMult = terrainMultipliers[inputs.terrain] ?? 1.0
  const terrainAdj  = grassAdj * terrainMult

  // Step 4: hours
  const estimatedHours = terrainAdj / 60

  // Step 5: labor price
  const laborPrice = estimatedHours * rate

  // Step 6: frequency multiplier
  const freqMult             = frequencyMultipliers[inputs.frequency] ?? 1.0
  const frequencyAdjustedPrice = laborPrice * freqMult

  // Step 7: add-ons
  const bagging     = addOnPrices.bagging[inputs.baggingLevel]         ?? 0
  const haulOff     = inputs.haulOffLevel === 'large'
    ? inputs.haulOffCustom
    : (addOnPrices.haulOff[inputs.haulOffLevel]                        ?? 0)
  const leafCleanup = inputs.leafCleanupLevel === 'custom'
    ? inputs.leafCleanupCustom
    : (addOnPrices.leafCleanup[inputs.leafCleanupLevel]                ?? 0)
  const shrubs      = (inputs.shrubSmallCount  * addOnPrices.shrubSmall)
                    + (inputs.shrubMediumCount * addOnPrices.shrubMedium)
                    + (inputs.shrubLargeCount  * addOnPrices.shrubLarge)
  const stickPickup = addOnPrices.stickPickup[inputs.stickPickupLevel] ?? 0
  const addOnsTotal = bagging + haulOff + leafCleanup + shrubs + stickPickup

  const subtotalBeforeMinimum = frequencyAdjustedPrice + (inputs.travelFee || 0) + addOnsTotal

  // Step 8: minimum
  const minimumApplied = subtotalBeforeMinimum < minimumServicePrice
  const afterMinimum   = minimumApplied ? minimumServicePrice : subtotalBeforeMinimum

  // Step 9: round
  const finalEstimate = Math.ceil(afterMinimum / roundToNearest) * roundToNearest

  const breakdown: EstimateBreakdown = {
    setupMinutes:          inputs.setupMinutes,
    mowingMinutes:         inputs.mowingMinutes,
    weedEatingMinutes:     weMin,
    edgingMinutes:         edMin,
    blowOffMinutes:        boMin,
    obstacleMinutes:       obsMin,
    baseLaborMinutes,
    grassAdjustedMinutes:  Math.round(grassAdj),
    terrainAdjustedMinutes: Math.round(terrainAdj),
    estimatedHours:        parseFloat(estimatedHours.toFixed(2)),
    laborPrice:            parseFloat(laborPrice.toFixed(2)),
    frequencyMultiplier:   freqMult,
    frequencyAdjustedPrice: parseFloat(frequencyAdjustedPrice.toFixed(2)),
    addOnsTotal:           parseFloat(addOnsTotal.toFixed(2)),
    travelFee:             inputs.travelFee || 0,
    subtotalBeforeMinimum: parseFloat(subtotalBeforeMinimum.toFixed(2)),
    minimumApplied,
    finalEstimate,
  }

  // Build human-readable line items for display / SMS
  const lineItems: EstimateResult['lineItems'] = [
    { label: 'Setup / Load & Unload', minutes: inputs.setupMinutes },
    { label: 'Mowing',                minutes: inputs.mowingMinutes },
  ]
  if (weMin > 0) lineItems.push({ label: 'Weed Eating', minutes: weMin })
  if (edMin > 0) lineItems.push({ label: 'Edging',      minutes: edMin })
  if (boMin > 0) lineItems.push({ label: 'Blow Off',    minutes: boMin })
  if (obsMin > 0) lineItems.push({ label: 'Obstacles / Extra areas', minutes: obsMin })

  if (bagging > 0)     lineItems.push({ label: 'Bagging clippings',   price: bagging,     isAddOn: true })
  if (haulOff > 0)     lineItems.push({ label: 'Haul-off',            price: haulOff,     isAddOn: true })
  if (leafCleanup > 0) lineItems.push({ label: 'Leaf cleanup',        price: leafCleanup, isAddOn: true })
  if (shrubs > 0)      lineItems.push({ label: 'Shrub trimming',      price: shrubs,      isAddOn: true })
  if (stickPickup > 0) lineItems.push({ label: 'Stick / limb pickup', price: stickPickup, isAddOn: true })
  if ((inputs.travelFee || 0) > 0) lineItems.push({ label: 'Travel fee', price: inputs.travelFee, isAddOn: true })

  return {
    breakdown,
    totalMinutes: Math.round(terrainAdj),
    finalEstimate,
    lineItems,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}

/** Given mowable acres, pick the closest size key and return suggested mow minutes. */
export function acrestoMowMinutes(acres: number, settings: PricingSettings = DEFAULT_SETTINGS): number {
  const sizes = Object.keys(settings.mowingMinutesBySize).map(Number).sort((a, b) => a - b)
  // find closest tier
  let closest = sizes[0]
  for (const s of sizes) {
    if (acres >= s) closest = s
  }
  const key = String(closest)
  return settings.mowingMinutesBySize[key] ?? 60
}

/** Round to nearest N. */
export function roundToNearest(value: number, nearest: number): number {
  return Math.ceil(value / nearest) * nearest
}

/**
 * Estimate mowable acres from parcel data.
 * Applies a tiered factor based on open lot size — small lots have proportionally
 * larger structure + hardscape footprints, so the mowable fraction is lower.
 * Vacant land gets a higher factor (little to no structure deduction).
 * TimberAcres is subtracted first before the factor is applied.
 */
export function estimateMowableAcres(
  totalAcres: number,
  timberAcres: number = 0,
  landUse: string | null | undefined = null,
): number {
  const openAcres = Math.max(totalAcres - timberAcres, 0)
  const isVacant = landUse ? /vacant|unimproved|bare|raw/i.test(landUse) : false

  let factor: number
  if (isVacant)              factor = 0.90 // mostly open, just scrub edges
  else if (openAcres < 0.25) factor = 0.55 // house + drive dominate tiny lot
  else if (openAcres < 0.50) factor = 0.62
  else if (openAcres < 1.00) factor = 0.70
  else if (openAcres < 2.00) factor = 0.78
  else if (openAcres < 5.00) factor = 0.84
  else if (openAcres < 10.0) factor = 0.88
  else                       factor = 0.91 // large rural tract

  return Math.round(openAcres * factor * 100) / 100
}
