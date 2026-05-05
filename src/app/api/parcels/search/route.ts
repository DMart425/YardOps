import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  const supabase = await createClient()
  const { data: parcels } = await supabase
    .from('parcels')
    .select('id, situs_address, owner_name, land_use, lot_sqft, source, raw_json')
    .ilike('situs_address', `%${q}%`)
    .limit(8)

  const sourceKeys = Array.from(new Set((parcels ?? []).map(p => p.source).filter(Boolean)))
  const sourceMetaByKey = new Map<string, { display_name: string; state: string; county: string }>()

  if (sourceKeys.length > 0) {
    const { data: sourceMetadata } = await supabase
      .from('parcel_sources')
      .select('source_key, display_name, state, county')
      .in('source_key', sourceKeys)

    for (const row of sourceMetadata ?? []) {
      sourceMetaByKey.set(row.source_key, {
        display_name: row.display_name,
        state: row.state,
        county: row.county,
      })
    }
  }

  const response = (parcels ?? []).map(parcel => ({
    ...parcel,
    source_metadata: parcel.source ? sourceMetaByKey.get(parcel.source) ?? null : null,
  }))

  return NextResponse.json(response)
}
