import { DEFAULT_SETTINGS } from '@/lib/pricing'
import type { EstimateInputs } from '@/lib/pricing'

export interface CustomerOption { id: string; first_name: string; last_name: string | null; phone?: string | null; notes?: string | null }
export interface PropertyOption {
  id: string; customer_id: string; property_name: string | null
  service_address: string; city: string | null
  parcel_acres: number | null; estimated_mowable_acres: number | null
  service_frequency: string | null; default_service_package: string | null
  default_mowing_enabled: boolean | null
  default_weed_eating_enabled: boolean | null
  default_edging_enabled: boolean | null
  default_blow_off_enabled: boolean | null
}

export interface ParcelResult {
  id: string
  situs_address: string | null
  owner_name: string | null
  land_use: string | null
  lot_sqft: number | null
  raw_json: { attributes?: Record<string, unknown> } | null
}

// Setter passed from EstimateForm down to each section — updates one field of
// the parent's EstimateInputs state.
export type SetEstimateInput = <K extends keyof EstimateInputs>(key: K, value: EstimateInputs[K]) => void

const S = DEFAULT_SETTINGS

export function defaultInputs(rate?: number): EstimateInputs {
  return {
    mowingMinutes:         60,
    setupMinutes:          S.defaultSetupMinutes,
    weedEatingLevel:       'normal',
    edgingLevel:           'normal',
    blowOffLevel:          'normal',
    grassCondition:        'maintained',
    terrain:               'flat',
    frequency:             'weekly',
    obstacles:             [],
    customObstacleMinutes: 0,
    baggingLevel:          'none',
    haulOffLevel:          'none',
    haulOffCustom:         0,
    leafCleanupLevel:      'none',
    leafCleanupCustom:     0,
    shrubSmallCount:       0,
    shrubMediumCount:      0,
    shrubLargeCount:       0,
    stickPickupLevel:      'none',
    travelFee:             0,
    hourlyRate:            rate ?? S.targetHourlyRate,
  }
}

export const OBSTACLE_OPTIONS = [
  { key: 'fence_line',         label: 'Fence line (+10 min)' },
  { key: 'many_trees',         label: 'Many trees (+10 min)' },
  { key: 'playset_trampoline', label: 'Playset / Trampoline (+5 min)' },
  { key: 'sheds_outbuildings', label: 'Sheds / Outbuildings (+5 min)' },
  { key: 'flower_beds',        label: 'Flower beds / Landscape borders (+10 min)' },
  { key: 'tight_gate',         label: 'Tight gate (+5 min)' },
  { key: 'pool_area',          label: 'Pool area (+10 min)' },
  { key: 'ditch',              label: 'Ditch (+15 min)' },
]

export function mapPropertyFrequency(value: string | null): EstimateInputs['frequency'] | null {
  if (!value) return null
  if (value === 'weekly' || value === 'biweekly' || value === 'one_time' || value === 'monthly') {
    return value
  }
  return null
}

export function packageDefaults(packageCode: string | null): Partial<EstimateInputs> {
  switch (packageCode) {
    case 'mow_only':
      return {
        weedEatingLevel: 'none',
        edgingLevel: 'none',
        blowOffLevel: 'none',
      }
    case 'mow_blow':
      return {
        weedEatingLevel: 'none',
        edgingLevel: 'none',
        blowOffLevel: 'normal',
      }
    case 'full_service_mow_edge_trim_blow':
      return {
        weedEatingLevel: 'normal',
        edgingLevel: 'normal',
        blowOffLevel: 'normal',
      }
    case 'first_cut_overgrown':
      return {
        grassCondition: 'overgrown',
        weedEatingLevel: 'heavy',
        edgingLevel: 'normal',
        blowOffLevel: 'heavy_cleanup',
      }
    case 'leaf_cleanup':
      return {
        leafCleanupLevel: 'medium',
      }
    default:
      return {}
  }
}

export function serviceInterestDefaults(interests: Set<string>): Partial<EstimateInputs> {
  if (interests.size === 0) return {}

  return {
    weedEatingLevel: interests.has('weed_eating') ? 'normal' : 'none',
    edgingLevel: interests.has('edging') ? 'normal' : 'none',
    blowOffLevel: interests.has('blow_off') ? 'normal' : 'none',
  }
}

export function propertyBooleanDefaults(prop: PropertyOption): Partial<EstimateInputs> | null {
  if (
    prop.default_mowing_enabled      == null &&
    prop.default_weed_eating_enabled == null &&
    prop.default_edging_enabled      == null &&
    prop.default_blow_off_enabled    == null
  ) return null
  const result: Partial<EstimateInputs> = {}
  if (prop.default_weed_eating_enabled != null) {
    result.weedEatingLevel = prop.default_weed_eating_enabled ? 'normal' : 'none'
  }
  if (prop.default_edging_enabled != null) {
    result.edgingLevel = prop.default_edging_enabled ? 'normal' : 'none'
  }
  if (prop.default_blow_off_enabled != null) {
    result.blowOffLevel = prop.default_blow_off_enabled ? 'normal' : 'none'
  }
  return result
}
