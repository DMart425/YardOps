// Normalize website lead frequency (old or new format) to canonical property frequency or null.
// Old website format: 'Weekly', 'Biweekly', 'One-Time Cut', 'Not Sure Yet'
// New website format: 'weekly', 'biweekly', 'one_time', 'unsure'
// Output: 'weekly' | 'biweekly' | 'one_time' | 'custom' | 'paused' | null
export function normalizeFrequency(value: string | null | undefined): string | null {
  if (!value) return null

  const lower = value.trim().toLowerCase()

  // New canonical values (pass through)
  if (lower === 'weekly') return 'weekly'
  if (lower === 'biweekly' || lower === 'bi-weekly') return 'biweekly'
  if (lower === 'one_time' || lower === 'one time') return 'one_time'
  if (lower === 'custom') return 'custom'
  if (lower === 'paused') return 'paused'

  // Old display labels from legacy website
  if (lower === 'weekly') return 'weekly'
  if (lower === 'biweekly' || lower === 'bi-weekly' || lower === 'bi weekly') return 'biweekly'
  if (lower === 'one-time cut' || lower === 'one-time' || lower === 'one time cut') return 'one_time'

  // Unsure / unknown — fail safe to null (no property prefill)
  if (lower === 'unsure' || lower === 'not sure yet' || lower === 'not sure') return null

  // Unknown value — fail safe to null
  return null
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
