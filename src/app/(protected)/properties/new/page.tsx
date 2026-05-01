import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PropertyForm } from '@/components/forms/PropertyForm'
import { createProperty } from '../actions'

export default async function NewPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string }>
}) {
  const { customer_id } = await searchParams
  const supabase = await createClient()

  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, status')
    .neq('status', 'archived')
    .order('first_name')

  return (
    <div className="page">
      <Link href={customer_id ? `/customers/${customer_id}` : '/properties'} className="back-link">
        ← {customer_id ? 'Customer' : 'Properties'}
      </Link>
      <div className="page-header">
        <h1 className="page-title">Add Property</h1>
      </div>

      <div className="card">
        <PropertyForm
          action={createProperty}
          submitLabel="Add Property"
          cancelHref={customer_id ? `/customers/${customer_id}` : '/properties'}
          customers={customers ?? []}
          defaultCustomerId={customer_id}
        />
      </div>
    </div>
  )
}
