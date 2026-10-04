import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { LOCAL_STATION_ID } from '@/lib/local/constants'
import { hashPin } from '@/lib/local/pin'
import { setSessionUserId } from '@/lib/local/session'

// POST — first run: create the station and its owner, and sign the owner in.
export async function POST(request) {
  const { data: existing } = await localDb.from('organizations').select('id').eq('id', LOCAL_STATION_ID).maybeSingle()
  if (existing) return NextResponse.json({ error: 'This computer is already set up' }, { status: 409 })

  const { stationName, ownerName, username, pin } = await request.json()
  const login = String(username || '').trim().toLowerCase()
  if (!stationName?.trim() || !ownerName?.trim()) return NextResponse.json({ error: 'Station name and your name are required' }, { status: 400 })
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) return NextResponse.json({ error: 'Username: 2-32 letters, numbers, dots, dashes or underscores' }, { status: 400 })
  if (!/^\d{4,8}$/.test(String(pin || ''))) return NextResponse.json({ error: 'PIN must be 4 to 8 digits' }, { status: 400 })

  const { data: owner, error: userErr } = await localDb
    .from('users')
    .insert({ email: login, name: ownerName.trim(), role: 'user', pin_hash: await hashPin(pin) })
    .select('id').single()
  if (userErr) return NextResponse.json({ error: 'Could not create your account' }, { status: 500 })

  const { error: orgErr } = await localDb.from('organizations').insert({
    id: LOCAL_STATION_ID,
    name: stationName.trim(),
    slug: 'station',
    owner_id: owner.id,
  })
  if (orgErr) {
    await localDb.from('users').delete().eq('id', owner.id)
    return NextResponse.json({ error: 'Could not create the station' }, { status: 500 })
  }
  await localDb.from('users').update({ org_id: LOCAL_STATION_ID }).eq('id', owner.id)

  setSessionUserId(owner.id)
  return NextResponse.json({ ok: true, stationId: LOCAL_STATION_ID })
}
