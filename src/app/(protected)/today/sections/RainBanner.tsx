export function RainBanner({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="card" style={{ marginBottom: '1rem', background: 'rgba(80,140,255,0.12)', borderLeft: '3px solid #4a90e2' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.5rem' }}>🌧</span>
        <div>
          <div className="font-bold">Rain expected today</div>
          <div className="text-small text-muted">Consider rescheduling jobs at higher-risk locations.</div>
        </div>
      </div>
    </div>
  )
}
