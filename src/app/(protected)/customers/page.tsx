import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Customer } from '@/types/database'

export default async function CustomersPage() {
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .in('status', ['active', 'inactive'])
    .order('first_name', { ascending: true })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers?.length ?? 0} total</p>
        </div>
        <Link href="/customers/new" className="btn btn-primary btn-sm">+ Add</Link>
      </div>

      {!customers?.length ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>👷</p>
          <p style={{ fontWeight: 600, marginTop: '8px' }}>No customers yet</p>
          <p>Add your first customer to get started.</p>
          <Link href="/customers/new" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Add Customer
          </Link>
        </div>
      ) : (
        customers.map((c: Customer) => (
          <Link key={c.id} href={`/customers/${c.id}`} style={{ display: 'block' }}>
            <div className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">
                    {c.first_name}{c.last_name ? ` ${c.last_name}` : ''}
                  </div>
                  {c.phone && <div className="contact-row">📞 {c.phone}</div>}
                  {c.email && <div className="contact-row">✉ {c.email}</div>}
                </div>
                <span className={`pill pill-${c.status}`}>{c.status}</span>
              </div>
              {c.notes && <div className="card-meta" style={{ marginTop: '8px' }}>{c.notes}</div>}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}
