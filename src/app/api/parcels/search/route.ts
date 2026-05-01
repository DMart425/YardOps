import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  const supabase = await createClient()
  const { data } = await supabase
    .from('parcels')
    .select('id, situs_address, owner_name, land_use, lot_sqft, raw_json')
    .ilike('situs_address', `%${q}%`)
    .limit(8)

  return NextResponse.json(data ?? [])
}
