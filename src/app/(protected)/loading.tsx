// Route-level loading state for the protected app. /today blocks on many
// queries plus transient geocode/weather fetches; on slow rural connections
// the app previously rendered nothing at all until everything resolved.
export default function ProtectedLoading() {
  return (
    <div className="empty-state" role="status" aria-label="Loading">
      <div
        style={{
          width: '28px',
          height: '28px',
          margin: '0 auto 12px',
          border: '3px solid var(--color-border, #333)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="text-small text-muted">Loading…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
