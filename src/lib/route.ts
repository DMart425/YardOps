// Route ordering helpers — pure TypeScript, no React (used by server pages).
//
// Ordering rules:
//  1. Time-window buckets come first: morning → anytime/custom → afternoon
//     → evening. A promise to a customer beats geometry.
//  2. Within each bucket, stops are nearest-neighbor ordered starting from
//     the route cursor: the home base (when set) for the first bucket, then
//     the last stop of the previous bucket. Without a start point the walk
//     seeds from the northernmost stop (legacy behavior).
//  3. Stops without coordinates keep their relative order at the end of
//     their bucket — never dropped.

export interface RouteCoord {
  latitude: number
  longitude: number
}

export interface RouteStopInfo {
  coord: RouteCoord | null
  timeWindow: string | null
}

// morning → 0, anytime/blank/custom text → 1, afternoon → 2, evening → 3
function windowBucket(timeWindow: string | null): number {
  const tw = (timeWindow ?? '').trim().toLowerCase()
  if (tw === 'morning') return 0
  if (tw === 'afternoon') return 2
  if (tw === 'evening') return 3
  return 1
}

function dist(a: RouteCoord, b: RouteCoord): number {
  return Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude)
}

export function orderStopsForRoute<T>(
  stops: T[],
  getInfo: (stop: T) => RouteStopInfo,
  start?: RouteCoord | null,
): T[] {
  const buckets: T[][] = [[], [], [], []]
  for (const s of stops) buckets[windowBucket(getInfo(s).timeWindow)].push(s)

  const result: T[] = []
  let cursor: RouteCoord | null = start ?? null

  for (const bucket of buckets) {
    const withCoords    = bucket.filter(s => getInfo(s).coord != null)
    const withoutCoords = bucket.filter(s => getInfo(s).coord == null)

    const remaining = [...withCoords]
    while (remaining.length > 0) {
      let idx = 0
      if (cursor != null) {
        for (let i = 1; i < remaining.length; i++) {
          if (dist(getInfo(remaining[i]).coord!, cursor) < dist(getInfo(remaining[idx]).coord!, cursor)) idx = i
        }
      } else {
        // No start point yet — seed from the northernmost stop
        for (let i = 1; i < remaining.length; i++) {
          if (getInfo(remaining[i]).coord!.latitude > getInfo(remaining[idx]).coord!.latitude) idx = i
        }
      }
      const next = remaining.splice(idx, 1)[0]
      result.push(next)
      cursor = getInfo(next).coord!
    }

    result.push(...withoutCoords)
  }

  return result
}

/**
 * Google Maps URL for the ordered stops. With an origin (home base) the
 * route starts there; otherwise Google starts from the device's location.
 * Note: the Maps URL API honors the given waypoint order — it does not
 * re-optimize — which is why ordering happens in orderStopsForRoute first.
 */
export function buildRouteUrl(addresses: string[], origin?: string | null): string | null {
  if (addresses.length === 0) return null
  if (addresses.length === 1 && !origin) {
    return `https://maps.google.com/?q=${encodeURIComponent(addresses[0])}`
  }
  const dest = encodeURIComponent(addresses[addresses.length - 1])
  // Components are individually encoded; the separator itself must be the
  // encoded pipe (%7C) — a literal '|' is invalid in URLs.
  const waypoints = addresses.slice(0, -1).map(encodeURIComponent).join('%7C')
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : ''
  const wpParam = waypoints ? `&waypoints=${waypoints}` : ''
  return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}${wpParam}&travelmode=driving`
}
