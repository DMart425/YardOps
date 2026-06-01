/**
 * Open-Meteo weather forecast — free, no API key, no rate limits.
 * Docs: https://open-meteo.com/en/docs
 */

export interface DayForecast {
  date: string             // YYYY-MM-DD
  tempHi: number           // °F — daily high
  tempLo: number           // °F — daily low
  currentTemp: number      // °F — current actual temperature; falls back to daily high
  currentSummary: string   // current WMO condition label; falls back to daily summary
  currentEmoji: string     // current WMO emoji; falls back to daily emoji
  precipChance: number     // % — daily max precip probability
  precipInches: number     // inches — daily precip sum
  weatherCode: number      // WMO code (daily dominant — kept for rain banner logic)
  summary: string          // daily condition label
  emoji: string            // daily emoji
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number   // current actual temperature
    weather_code?: number     // current WMO condition code
  }
  daily?: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
    precipitation_sum: number[]
    weather_code: number[]
  }
}

const WMO_CODES: Record<number, { summary: string; emoji: string }> = {
  0:  { summary: 'Clear',           emoji: '☀️' },
  1:  { summary: 'Mostly clear',    emoji: '🌤' },
  2:  { summary: 'Partly cloudy',   emoji: '⛅' },
  3:  { summary: 'Overcast',        emoji: '☁️' },
  45: { summary: 'Fog',             emoji: '🌫' },
  48: { summary: 'Fog',             emoji: '🌫' },
  51: { summary: 'Light drizzle',   emoji: '🌦' },
  53: { summary: 'Drizzle',         emoji: '🌦' },
  55: { summary: 'Heavy drizzle',   emoji: '🌧' },
  61: { summary: 'Light rain',      emoji: '🌦' },
  63: { summary: 'Rain',            emoji: '🌧' },
  65: { summary: 'Heavy rain',      emoji: '⛈' },
  71: { summary: 'Light snow',      emoji: '🌨' },
  73: { summary: 'Snow',            emoji: '❄️' },
  75: { summary: 'Heavy snow',      emoji: '❄️' },
  80: { summary: 'Showers',         emoji: '🌦' },
  81: { summary: 'Showers',         emoji: '🌧' },
  82: { summary: 'Heavy showers',   emoji: '⛈' },
  95: { summary: 'Thunderstorm',    emoji: '⛈' },
  96: { summary: 'Thunder + hail',  emoji: '⛈' },
  99: { summary: 'Severe thunder',  emoji: '⛈' },
}

/**
 * Fetch a 3-day forecast for a single lat/lon. Cached 30 min via Next.js fetch cache.
 */
export async function getForecast(lat: number, lon: number): Promise<DayForecast[] | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lon.toFixed(4))
  url.searchParams.set('current', 'temperature_2m,weather_code')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('temperature_unit', 'fahrenheit')
  url.searchParams.set('precipitation_unit', 'inch')
  url.searchParams.set('forecast_days', '3')

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 1800 } })
    if (!res.ok) return null
    const data = (await res.json()) as OpenMeteoResponse
    if (!data.daily) return null

    return data.daily.time.map((date, i) => {
      const code = data.daily!.weather_code[i] ?? 0
      const meta = WMO_CODES[code] ?? { summary: 'Unknown', emoji: '🌡' }

      // Current conditions are only available for today (index 0).
      // For future days fall back to the daily dominant code and daily high.
      const rawCurrentCode = i === 0 ? data.current?.weather_code : undefined
      const currentMeta = rawCurrentCode != null
        ? (WMO_CODES[rawCurrentCode] ?? { summary: 'Unknown', emoji: '🌡' })
        : meta
      const currentTemp = i === 0 && data.current?.temperature_2m != null
        ? Math.round(data.current.temperature_2m)
        : Math.round(data.daily!.temperature_2m_max[i])

      return {
        date,
        tempHi: Math.round(data.daily!.temperature_2m_max[i]),
        tempLo: Math.round(data.daily!.temperature_2m_min[i]),
        currentTemp,
        currentSummary: currentMeta.summary,
        currentEmoji: currentMeta.emoji,
        precipChance: data.daily!.precipitation_probability_max[i] ?? 0,
        precipInches: data.daily!.precipitation_sum[i] ?? 0,
        weatherCode: code,
        summary: meta.summary,
        emoji: meta.emoji,
      }
    })
  } catch {
    return null
  }
}

/**
 * Fetch forecasts for many lat/lon pairs in parallel, deduped by 3-decimal precision.
 * Returns a map keyed by "lat,lon" (rounded to 3 decimals) → today's forecast only.
 */
export async function getTodayForecastForCoords(
  coords: Array<{ lat: number; lon: number }>
): Promise<Map<string, DayForecast>> {
  const unique = new Map<string, { lat: number; lon: number }>()
  for (const c of coords) {
    const key = `${c.lat.toFixed(3)},${c.lon.toFixed(3)}`
    if (!unique.has(key)) unique.set(key, c)
  }

  const results = await Promise.all(
    Array.from(unique.entries()).map(async ([key, c]) => {
      const forecast = await getForecast(c.lat, c.lon)
      return [key, forecast?.[0] ?? null] as const
    })
  )

  const map = new Map<string, DayForecast>()
  for (const [key, fc] of results) {
    if (fc) map.set(key, fc)
  }
  return map
}

export function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}
