import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import { SettingsForm } from '@/components/forms/SettingsForm'
import { BackfillCoordinatesButton } from '@/components/BackfillCoordinatesButton'
import { DataExportSection } from '@/components/DataExportSection'
import { EnableNotificationsButton } from '@/components/EnableNotificationsButton'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('pricing_settings')
    .select('*')
    .single()

  const defaults = {
    target_hourly_rate:    settings?.target_hourly_rate    ?? DEFAULT_SETTINGS.targetHourlyRate,
    minimum_price:         settings?.minimum_price         ?? DEFAULT_SETTINGS.minimumServicePrice,
    round_to_nearest:      settings?.round_to_nearest      ?? DEFAULT_SETTINGS.roundToNearest,
    default_setup_minutes: settings?.default_setup_minutes ?? DEFAULT_SETTINGS.defaultSetupMinutes,
    venmo_handle:          settings?.venmo_handle          ?? '',
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <SettingsForm defaults={defaults} />
      <EnableNotificationsButton />
      <BackfillCoordinatesButton />
      <DataExportSection />
    </div>
  )
}
