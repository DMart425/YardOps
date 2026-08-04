// Server-compatible (no hooks). Renders nothing when message is null so pages
// can pass firstReadError(...) results unconditionally.
export function ReadErrorNotice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="alert alert-error" style={{ marginBottom: '12px' }}>
      Some data failed to load — lists and totals below may be incomplete. Pull to refresh or try again. ({message})
    </div>
  )
}
