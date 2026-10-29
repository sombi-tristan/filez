import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess } from '@/lib/stationAccess'

/**
 * The Summary report's AGO sheet: the date its list starts from (organizations.ago_reset_date,
 * migration 059). Anyone with access to the station may read it and press Reset, which sets it
 * to the phone's own date (so it is the day the person sees, whatever the server's time zone).
 */
const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { stationId } = await params
    const { ok } = await hasStationAccess(user, stationId)
    if (!ok) return NextResponse.json({ error: 'Station not found' }, { status: 404 })

    const { data } = await getAdminClient()
      .from('organizations')
      .select('ago_reset_date')
      .eq('id', stationId)
      .maybeSingle()
    return NextResponse.json({ resetDate: data?.ago_reset_date || null })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { stationId } = await params
    const { ok } = await hasStationAccess(user, stationId)
    if (!ok) return NextResponse.json({ error: 'Station not found' }, { status: 404 })

    const { date } = await request.json().catch(() => ({}))
    if (!DAY.test(String(date || ''))) return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })

    const { error } = await getAdminClient()
      .from('organizations')
      .update({ ago_reset_date: date })
      .eq('id', stationId)
    if (error) return NextResponse.json({ error: 'Failed to reset' }, { status: 500 })
    return NextResponse.json({ resetDate: date })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
