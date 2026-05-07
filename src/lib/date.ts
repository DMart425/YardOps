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