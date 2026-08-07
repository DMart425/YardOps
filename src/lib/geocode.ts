/**
 * Geocode a US street address using OpenStreetMap Nominatim.
 * Free, no API key. Rate limit: 1 req/sec — fine for our usage.
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 */

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  importance?: number
}

const USER_AGENT = 'YardOps/1.0 (https://app.wicksburglawnservice.com)'

export interface GeocodeResult {
  latitude: number
  longitude: number
  displayName: string
}

/**
 * Geocode an address. Returns null if no result or on error.
 */
export async function geocodeAddress(parts: {
  address: string
  city?: string | null
  state?: string | null
  postalCode?: string | null
}): Promise<GeocodeResult | null> {
  // Build a structured query — more reliable than free-form
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'us')
  url.searchParams.set('street', parts.address)
  if (parts.city) url.searchParams.set('city', parts.city)
  if (parts.state) url.searchParams.set('state', parts.state)
  if (parts.postalCode) url.searchParams.set('postalcode', parts.postalCode)

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 60 * 60 * 24 * 30 }, // cache 30 days
    })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimResult[]
    if (!data || data.length === 0) {
      // Fallback 1: free-form full-address query (handles formatting variants)
      const freeformResult = await geocodeFreeform(
        [parts.address, parts.city, parts.state, parts.postalCode].filter(Boolean).join(', ')
      )
      if (freeformResult) return freeformResult

      // Fallback 2: city/ZIP centroid — for rural addresses not in OSM street
      // data. Town-level approximation, good enough for weather.
      // NOTE: must use a STRUCTURED query or "City, State" freeform — the
      // combined freeform "CITY, ST, ZIP" string fails Nominatim's parser
      // (verified 2026-08-06 with "NEWTON, AL, 36352" → no match).
      return geocodeCentroid(parts)
    }
    const top = data[0]
    return {
      latitude: parseFloat(top.lat),
      longitude: parseFloat(top.lon),
      displayName: top.display_name,
    }
  } catch {
    return null
  }
}

/**
 * Town-level centroid lookup, tried three ways in order of precision:
 * structured city+state+ZIP → freeform "City, State" → structured ZIP only.
 */
async function geocodeCentroid(parts: {
  city?: string | null
  state?: string | null
  postalCode?: string | null
}): Promise<GeocodeResult | null> {
  if (parts.city || parts.postalCode) {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'us')
    if (parts.city)       url.searchParams.set('city', parts.city)
    if (parts.state)      url.searchParams.set('state', parts.state)
    if (parts.postalCode) url.searchParams.set('postalcode', parts.postalCode)
    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT },
        next: { revalidate: 60 * 60 * 24 * 30 },
      })
      if (res.ok) {
        const data = (await res.json()) as NominatimResult[]
        if (data && data.length > 0) {
          return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon), displayName: data[0].display_name }
        }
      }
    } catch {
      // fall through to the next attempt
    }
  }

  if (parts.city && parts.state) {
    const byName = await geocodeFreeform(`${parts.city}, ${parts.state}`)
    if (byName) return byName
  }

  if (parts.postalCode) {
    return geocodeFreeform(`${parts.postalCode} USA`)
  }

  return null
}

async function geocodeFreeform(q: string): Promise<GeocodeResult | null> {
  if (!q.trim()) return null
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'us')
  url.searchParams.set('q', q)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as NominatimResult[]
    if (!data || data.length === 0) return null
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    }
  } catch {
    return null
  }
}
