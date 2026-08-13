// Minimal error logging — one consistent, greppable prefix in Vercel
// function logs (search "yardops:" to see every recorded failure). This is
// deliberately not a monitoring service; real observability (Sentry etc.)
// is on the productization list.

export function logError(context: string, error: unknown): void {
  const detail =
    error instanceof Error
      ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error)
  console.error(`[yardops:${context}]`, detail)
}
