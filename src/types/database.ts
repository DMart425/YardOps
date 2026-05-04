export type CustomerStatus = 'lead' | 'active' | 'inactive' | 'archived'
export type PropertyStatus = 'active' | 'inactive' | 'archived'
export type ServiceFrequency = 'weekly' | 'biweekly' | 'one_time' | 'custom' | 'paused'
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'cancelled' | 'needs_reschedule'
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'not_billable'
export type JobType = 'recurring' | 'one_time'
export type MessageType =
  | 'day_before_service_reminder'
  | 'on_my_way'
  | 'arriving_shortly'
  | 'job_complete'
  | 'receipt_paid'
  | 'receipt_unpaid'
  | 'payment_reminder'
  | 'estimate_follow_up'

export interface Profile {
  id: string
  business_name: string | null
  owner_name: string | null
  business_phone: string | null
  business_email: string | null
  service_radius_miles: number | null
  default_hourly_rate: number | null
  minimum_visit_charge: number | null
  default_equipment_cost_per_hour: number | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  created_by: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  preferred_contact_method: string | null
  notes: string | null
  status: CustomerStatus
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  created_by: string
  customer_id: string
  parcel_id: string | null
  property_name: string | null
  service_address: string
  city: string | null
  state: string | null
  postal_code: string | null
  county: string | null
  full_address: string | null
  normalized_address: string | null
  latitude: number | null
  longitude: number | null
  parcel_acres: number | null
  estimated_mowable_acres: number | null
  estimated_lot_sqft: number | null
  lot_size_source: string | null
  default_service_package: string | null
  default_price: number | null
  service_frequency: ServiceFrequency
  preferred_service_day: string | null
  schedule_anchor_date: string | null
  auto_schedule_next: boolean
  gate_code: string | null
  access_notes: string | null
  pet_warning: string | null
  obstacle_notes: string | null
  parking_notes: string | null
  internal_notes: string | null
  status: PropertyStatus
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  created_by: string
  customer_id: string
  property_id: string
  estimate_id: string | null
  job_type: JobType
  title: string
  service_package: string | null
  scheduled_date: string | null
  scheduled_time_window: string | null
  status: JobStatus
  price: number | null
  quoted_total: number | null
  actual_total: number | null
  payment_status: PaymentStatus
  payment_method: string | null
  amount_paid: number
  completion_notes: string | null
  internal_notes: string | null
  customer_notes: string | null
  completed_at: string | null
  skipped_reason: string | null
  cancelled_reason: string | null
  rescheduled_from: string | null
  recurrence_source: string | null
  next_job_created_id: string | null
  day_before_reminder_sent: boolean
  day_before_reminder_sent_at: string | null
  started_at: string | null
  actual_minutes: number | null
  created_at: string
  updated_at: string
}

export interface MessageLog {
  id: string
  user_id: string
  customer_id: string | null
  property_id: string | null
  job_id: string | null
  estimate_id: string | null
  message_type: MessageType
  recipient_phone: string | null
  message_body: string | null
  delivery_method: string
  manually_marked_sent: boolean
  sent_at: string | null
  created_at: string
}

export interface Parcel {
  id: string
  source: string
  source_parcel_id: string
  apn: string | null
  owner_name: string | null
  situs_address: string | null
  mailing_address: string | null
  land_use: string | null
  lot_sqft: number | null
  lat: number | null
  lon: number | null
  raw_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BriefSettings {
  id: string
  user_id: string
  daily_brief_enabled: boolean
  daily_brief_time: string
  weekly_brief_enabled: boolean
  weekly_brief_day: string
  weekly_brief_time: string
  include_overdue: boolean
  include_unpaid: boolean
  include_estimates: boolean
  include_equipment: boolean
  created_at: string
  updated_at: string
}

export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired' | 'converted'

export interface Estimate {
  id: string
  created_by: string
  customer_id: string
  property_id: string
  estimate_number: string | null
  status: EstimateStatus
  valid_until: string | null
  subtotal: number
  tax: number
  total: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EstimateItem {
  id: string
  created_by: string
  estimate_id: string
  sort_order: number
  service_name: string
  description: string | null
  quantity: number
  unit: string | null
  unit_price: number
  line_total: number
  created_at: string
  updated_at: string
}

export type FormState = { error: string | null; success?: string | null; savedAt?: number | null }
