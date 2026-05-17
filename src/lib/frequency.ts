// Normalizes any known frequency input to a canonical property frequency value or null.
// Canonical output: 'weekly' | 'biweekly' | 'one_time' | 'custom' | 'paused' | null
// Accepted inputs: 'weekly', 'biweekly', 'bi-weekly', 'bi weekly',
//   'one_time', 'one time', 'one-time', 'one-time cut', 'one time cut',
//   'unsure', 'not sure yet', 'not sure' (last three → null)
export function normalizeFrequency(value: string | null | undefined): string | null {
  if (!value) return null

  const lower = value.trim().toLowerCase()

  if (lower === 'weekly') return 'weekly'

  if (lower === 'biweekly' || lower === 'bi-weekly' || lower === 'bi weekly') return 'biweekly'

  if (
    lower === 'one_time' ||
    lower === 'one time' ||
    lower === 'one-time' ||
    lower === 'one-time cut' ||
    lower === 'one time cut'
  ) return 'one_time'

  if (lower === 'custom') return 'custom'
  if (lower === 'paused') return 'paused'

  // Unsure / unknown — fail safe to null (no property prefill)
  if (lower === 'unsure' || lower === 'not sure yet' || lower === 'not sure') return null

  return null
}

// Format a canonical frequency value to a friendly label for display.
export function formatFrequencyLabel(value: string | null | undefined): string {
  if (!value) return 'Not specified'
  const lower = value.trim().toLowerCase()
  if (lower === 'weekly') return 'Weekly'
  if (lower === 'biweekly' || lower === 'bi-weekly' || lower === 'bi weekly') return 'Bi-weekly'
  if (lower === 'one_time') return 'One-time'
  if (lower === 'custom') return 'Custom'
  if (lower === 'paused') return 'Paused'
  if (lower === 'unsure') return 'Not sure yet'
  return value.replace(/_/g, ' ')
}

// Format a service interest key to a friendly label.
export function formatServiceInterestLabel(value: string): string {
  const labels: Record<string, string> = {
    mowing: 'Lawn mowing',
    weed_eating: 'Weed eating / trimming',
    edging: 'Edging',
    blow_off: 'Blow off walkways / driveway / patio',
  }
  return labels[value] ?? value.replace(/_/g, ' ')
}

// Parse website service interests from customer notes.
// Expects a structured block like:
//   Website service interests:
//   - mowing
//   - weed_eating
//   - edging
//   - blow_off
export function parseWebsiteServiceInterests(notes: string | null): Set<string> {
  if (!notes) return new Set()

  const interests = new Set<string>()
  const lines = notes.split('\n')
  let inServiceInterestsBlock = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for section header
    if (trimmed.toLowerCase().startsWith('website service interests:')) {
      inServiceInterestsBlock = true
      continue
    }

    // If we're in the block and hit a non-interest line (like another section), stop
    if (inServiceInterestsBlock && trimmed && !trimmed.startsWith('-')) {
      inServiceInterestsBlock = false
    }

    // Parse interest items
    if (inServiceInterestsBlock && trimmed.startsWith('-')) {
      const interest = trimmed.slice(1).trim()
      if (interest) {
        interests.add(interest)
      }
    }
  }

  return interests
}
