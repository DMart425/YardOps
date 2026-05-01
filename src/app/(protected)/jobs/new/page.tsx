import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { JobForm } from '@/components/forms/JobForm'
import { createJob } from '../actions'

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ customer_id?: string; property_id?: string }>
}) {
  const { customer_id, property_id } = await searchParams
  const supabase = await createClient()

  const [{ data: customers }, { data: properties }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, first_name, last_name, status')
      .neq('status', 'archived')
      .order('first_name'),
    supabase
      .from('properties')
      .select('id, customer_id, property_name, service_address, city, default_price, default_service_package, service_frequency, auto_schedule_next')
      .eq('status', 'active')
      .order('service_address'),
  ])

  return (
    <div className="page">
      <Link href="/jobs" className="back-link">← Jobs</Link>
      <div className="page-header">
        <h1 className="page-title">New Job</h1>
      </div>
      <div className="card">
        <JobForm
          action={createJob}
          submitLabel="Create Job"
          cancelHref="/jobs"
          customers={customers ?? []}
          properties={properties ?? []}
          defaultCustomerId={customer_id}
          defaultPropertyId={property_id}
        />
      </div>
    </div>
  )
}
