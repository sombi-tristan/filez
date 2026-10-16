import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabaseServer'
import { getServiceClient } from '@/lib/entryHelpers'

/**
 * The StationMGR Desktop computers linked to the signed-in owner's stations, and revoking one
 * (screens/dashboard/computers). A revoked computer can no longer push, pull or renew its
 * licence (lib/desktop.js authenticateDevice); what it already holds stays on it, and its paid
 * features close when its licence runs out.
 *
 * Browser sessions only: a computer cannot list or revoke computers with its device token.
 */
async function signedInOwner() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const service = getServiceClient()
  const { data: stations } = await service.from('organizations').select('id, name').eq('owner_id', user.id).order('name')
  return { user, service, stations: stations || [] }
}

// GET — every computer linked to a station this person owns, newest first.
export async function GET() {
  try {
    const { error, service, stations } = await signedInOwner()
    if (error) return error
    if (!stations.length) return NextResponse.json({ computers: [] })

    const names = new Map(stations.map((s) => [s.id, s.name]))
    const { data, error: listError } = await service
      .from('desktop_devices')
      .select('id, org_id, name, created_at, last_seen_at, revoked_at')
      .in('org_id', stations.map((s) => s.id))
      .order('created_at', { ascending: false })
    if (listError) return NextResponse.json({ error: 'Could not load the computers' }, { status: 500 })

    return NextResponse.json({
      computers: (data || []).map((d) => ({ ...d, station_name: names.get(d.org_id) || '' })),
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST { id } — revoke one of them. Revoking twice is harmless.
export async function POST(request) {
  try {
    const { error, service, stations } = await signedInOwner()
    if (error) return error
    const { id } = await request.json().catch(() => ({}))
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data: device } = await service.from('desktop_devices').select('id, org_id, revoked_at').eq('id', id).maybeSingle()
    if (!device || !stations.some((s) => s.id === device.org_id)) {
      return NextResponse.json({ error: 'Not one of your computers' }, { status: 404 })
    }
    if (device.revoked_at) return NextResponse.json({ ok: true, revoked_at: device.revoked_at })

    const revokedAt = new Date().toISOString()
    const { error: updateError } = await service.from('desktop_devices').update({ revoked_at: revokedAt }).eq('id', id)
    if (updateError) return NextResponse.json({ error: 'Could not revoke it' }, { status: 500 })
    return NextResponse.json({ ok: true, revoked_at: revokedAt })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
