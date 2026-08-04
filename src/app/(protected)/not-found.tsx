import Link from 'next/link'

// Rendered by notFound() calls from protected detail pages (job, customer,
// property, estimate lookups that miss or fail the business-scope check).
export default function ProtectedNotFound() {
  return (
    <div className="empty-state" style={{ maxWidth: '420px', margin: '0 auto' }}>
      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
      <h2 style={{ marginBottom: '8px' }}>Not found</h2>
      <p className="text-small text-muted" style={{ marginBottom: '16px' }}>
        This record doesn&apos;t exist or may have been deleted.
      </p>
      <Link href="/today" className="btn btn-primary btn-full">
        Go to Today
      </Link>
    </div>
  )
}
