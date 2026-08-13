export function dateOnlyToUtcMs(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

const SERVICE_LABELS: Record<string, string> = {
  mow_only:      'Mow Only',
  mow_trim_blow: 'Mow, Trim & Blow',
  trim_cleanup:  'Trim & Cleanup',
  full_service:  'Full Service',
}

export function servicePackageLabel(value: string | null | undefined): string {
  if (!value) return 'Service'
  return SERVICE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
}

export function statusLabel(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function deriveServiceLabel(
  pkg: string | null | undefined,
  prop: {
    default_mowing_enabled?: boolean | null
    default_weed_eating_enabled?: boolean | null
    default_edging_enabled?: boolean | null
    default_blow_off_enabled?: boolean | null
  } | null
): string {
  // Property booleans are more accurate than legacy package codes — prefer them first.
  const parts: string[] = []
  if (prop?.default_mowing_enabled)      parts.push('Mowing')
  if (prop?.default_weed_eating_enabled) parts.push('Weed Eating')
  if (prop?.default_edging_enabled)      parts.push('Edging')
  if (prop?.default_blow_off_enabled)    parts.push('Blow Off')
  if (parts.length > 0) return parts.join(', ')
  // Fall back to legacy service_package code for old jobs/properties without booleans.
  if (pkg) return servicePackageLabel(pkg)
  return 'Lawn Service'
}
