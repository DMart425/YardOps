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
