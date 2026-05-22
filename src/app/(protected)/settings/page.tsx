import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import { resolveTimeZone } from '@/lib/date'
import { SettingsForm } from '@/components/forms/SettingsForm'
import { BackfillCoordinatesButton } from '@/components/BackfillCoordinatesButton'
import { DataExportSection } from '@/components/DataExportSection'
import { EnableNotificationsButton } from '@/components/EnableNotificationsButton'
import { BlackoutDatesForm } from '@/components/BlackoutDatesForm'
import { requireBusinessContext } from '@/lib/business/context'
import { formatPhoneInput } from '@/lib/format'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { userId, businessId } = await requireBusinessContext()

  const [{ data: settings }, { data: businessRow }] = await Promise.all([
    supabase
      .from('pricing_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('phone')
      .eq('id', businessId)
      .single(),
  ])

  const defaults = {
    target_hourly_rate:    settings?.target_hourly_rate    ?? DEFAULT_SETTINGS.targetHourlyRate,
    minimum_price:         settings?.minimum_price         ?? DEFAULT_SETTINGS.minimumServicePrice,
    round_to_nearest:      settings?.round_to_nearest      ?? DEFAULT_SETTINGS.roundToNearest,
    default_setup_minutes: settings?.default_setup_minutes ?? DEFAULT_SETTINGS.defaultSetupMinutes,
    venmo_handle:          settings?.venmo_handle          ?? '',
    time_zone:             resolveTimeZone(settings?.time_zone),
    business_phone:        formatPhoneInput((businessRow?.phone as string | null) ?? ''),
  }

  const blackoutDates: string[] = (settings?.blackout_dates as string[] | null) ?? []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <SettingsForm defaults={defaults} />
      <BlackoutDatesForm dates={blackoutDates} />
      <EnableNotificationsButton />
      <BackfillCoordinatesButton />
      <DataExportSection />
    </div>
  )
}
