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

// Returns the nearest occurrence of `weekday` at or after `startDate`.
// If weekday is unrecognized, empty, or 'any', returns startDate unchanged.
// Uses UTC date math consistent with addDays.
export function getNearestWeekday(startDate: string, weekday: string): string {
  const target = WEEKDAY_INDEX[weekday.toLowerCase()]
  if (target === undefined) return startDate
  const [y, m, d] = startDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const current = date.getUTCDay()
  const diff = (target - current + 7) % 7
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}
