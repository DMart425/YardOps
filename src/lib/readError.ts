// Pure helper — no React imports (usable from any server or client module).
//
// Returns the first Supabase read-error message among the given errors, or
// null when every read succeeded. Dashboard/list pages use this to surface a
// visible notice when a query fails instead of silently rendering an empty
// page — for a solo operator, "No jobs today" caused by a failed read is
// indistinguishable from a genuinely empty day and can mean missed work.
export function firstReadError(
  ...errors: ({ message: string } | null | undefined)[]
): string | null {
  for (const e of errors) {
    if (e) return e.message
  }
  return null
}
