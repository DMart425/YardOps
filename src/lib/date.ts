export const APP_DEFAULT_TIMEZONE = 'UTC'

// Neutral fallback only. Pages should prefer the configured business timezone.
export function resolveTimeZone(raw: string | null | undefined): string {
  if (!raw) return APP_DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw })
    return raw
  } catch {
    return APP_DEFAULT_TIMEZONE
  }
}

export function getLocalDateStr(timeZone: string, date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatDateOnly(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', options)
}

export function formatTimestampDate(
  isoString: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  return new Date(isoString).toLocaleDateString('en-US', { ...options, timeZone })
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Converts a local date string (YYYY-MM-DD) to a UTC ISO string representing
// midnight in the given timezone. Use this for completed_at filter boundaries
// so that jobs completed late evening local time (= early morning UTC the next
// day) are correctly included within their local-date filter window.
//
// Example: localMidnightUtcIso('2026-06-07', 'America/Chicago')
//   → '2026-06-07T05:00:00.000Z'  (CDT = UTC-5, so midnight CDT = 05:00 UTC)
//
// Handles DST transitions and half-hour / 45-minute UTC offsets via Intl.
export function localMidnightUtcIso(localDateStr: string, timeZone: string): string {
  const [y, m, d] = localDateStr.split('-').map(Number)
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(utcMidnight)

  const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10)
  const localDateAtUtcMidnight =
    `${parts.find(p => p.type === 'year')!.value}-` +
    `${parts.find(p => p.type === 'month')!.value}-` +
    `${parts.find(p => p.type === 'day')!.value}`
  const localH = get('hour') % 24   // guard against Intl returning 24 for midnight
  const localM = get('minute')
  const localS = get('second')

  // UTC- timezone (e.g. CDT): at UTC midnight, local is still the previous day.
  //   Local midnight is in the future → add remaining seconds to UTC midnight.
  // UTC+ timezone: at UTC midnight, local has already passed midnight on the target day.
  //   Local midnight is in the past → subtract elapsed seconds from UTC midnight.
  const offsetMs = localDateAtUtcMidnight === localDateStr
    ? -(localH * 3600 + localM * 60 + localS) * 1000
    : (24 * 3600 - (localH * 3600 + localM * 60 + localS)) * 1000

  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + offsetMs).toISOString()
}

export function getLocalMonthKey(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(isoString))
}

export function getDateOnlyMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

// Returns the closest matching weekday to startDate, searching both backward and
// forward within a bounded window (default maxDays = 4 each direction).
// - backDays = how far to go backward to reach the target weekday
// - fwdDays  = 7 - backDays (forward distance; always sums to 7 with backDays)
// - If startDate is already on the target weekday, returns startDate unchanged.
// - Backward candidate is excluded when it would fall before options.minDate.
// - If both candidates are valid, the closer one wins; ties prefer the future date.
// - If neither candidate qualifies within maxDays, returns startDate unchanged
//   (caller should suppress the chip when result === startDate).
// - Unrecognized weekday strings return startDate unchanged.
// Uses UTC date math consistent with addDays.
export function getClosestWeekdayNearDate(
  startDate: string,
  weekday: string,
  options?: { minDate?: string; maxDays?: number },
): string {
  const target = WEEKDAY_INDEX[weekday.toLowerCase()]
  if (target === undefined) return startDate

  const maxDays = options?.maxDays ?? 4
  const minDate = options?.minDate

  const [y, m, d] = startDate.split('-').map(Number)
  const currentDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay()

  if (currentDay === target) return startDate   // already on preferred day

  const backDays = (currentDay - target + 7) % 7  // days to go backward
  const fwdDays  = 7 - backDays                    // days to go forward

  let backDate: string | null = null
  if (backDays <= maxDays) {
    const b = new Date(Date.UTC(y, m - 1, d - backDays))
    const bStr = b.toISOString().slice(0, 10)
    if (!minDate || bStr >= minDate) backDate = bStr
  }

  let fwdDate: string | null = null
  if (fwdDays <= maxDays) {
    const f = new Date(Date.UTC(y, m - 1, d + fwdDays))
    fwdDate = f.toISOString().slice(0, 10)
  }

  if (backDate && fwdDate) {
    // Smaller distance wins; ties prefer the future date
    return fwdDays <= backDays ? fwdDate : backDate
  }
  return backDate ?? fwdDate ?? startDate
}
