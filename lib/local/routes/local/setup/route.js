import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { store } from '@/lib/local/store'
import { getLink } from '@/lib/local/link'
import { LOCAL_STATION_ID } from '@/lib/local/constants'
import { hashPin } from '@/lib/local/pin'
import { setSessionUserId } from '@/lib/local/session'

// POST — first run: the owner chooses the username and PIN they will sign in with here, and is
// signed in. Either of two ways:
//
//   Not linked (the free start, no internet): the station is made here too, under the fixed
//   local id. Linking later moves it into the web station (lib/local/webSync.js).
//
//   Linked first: the owner's account here takes the web owner's id, so the station rows pulled
//   from the web (organizations.owner_id) already point at it. The station row comes from the
//   pull; it is only made here if the pull had not brought it.
export async function POST(request) {
  const link = getLink()

  const { data: users } = await localDb.from('users').select('id, pin_hash')
  if ((users || []).some((u) => u.pin_hash)) return NextResponse.json({ error: 'This computer is already set up' }, { status: 409 })

  const { stationName, ownerName, username, pin } = await request.json()
  const login = String(username || '').trim().toLowerCase()
  if (!link?.stationId && !stationName?.trim()) return NextResponse.json({ error: 'Station name is required' }, { status: 400 })
  if (!ownerName?.trim()) return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) return NextResponse.json({ error: 'Username: 2-32 letters, numbers, dots, dashes or underscores' }, { status: 400 })
  if (!/^\d{4,8}$/.test(String(pin || ''))) return NextResponse.json({ error: 'PIN must be 4 to 8 digits' }, { status: 400 })

  if (!link?.stationId) return createLocalStation({ stationName: stationName.trim(), ownerName: ownerName.trim(), login, pin })

  const ownerId = link.ownerId
  await store.users.put({
    ...(await store.users.get(ownerId)),
    id: ownerId,
    email: login,
    name: ownerName.trim(),
    role: 'user',
    org_id: link.stationId,
    pin_hash: await hashPin(pin),
    created_at: new Date().toISOString(),
  })

  const station = await store.organizations.get(link.stationId)
  // Written straight to the store, not through the outbox: who holds the PIN here is not the
  // web's business (a push never changes a station's owner anyway).
  await store.organizations.put({
    ...(station || { id: link.stationId, name: link.stationName || 'Station', slug: 'station', created_at: new Date().toISOString() }),
    owner_id: ownerId,
  })

  setSessionUserId(ownerId)
  return NextResponse.json({ ok: true, stationId: link.stationId, onboardingComplete: Boolean(station?.onboarding_complete) })
}

async function createLocalStation({ stationName, ownerName, login, pin }) {
  const { data: owner, error: userErr } = await localDb
    .from('users')
    .insert({ email: login, name: ownerName, role: 'user', pin_hash: await hashPin(pin) })
    .select('id').single()
  if (userErr) return NextResponse.json({ error: 'Could not create your account' }, { status: 500 })

  const { error: orgErr } = await localDb.from('organizations').upsert({
    id: LOCAL_STATION_ID,
    name: stationName,
    slug: 'station',
    owner_id: owner.id,
    created_at: new Date().toISOString(),
  })
  if (orgErr) {
    await localDb.from('users').delete().eq('id', owner.id)
    return NextResponse.json({ error: 'Could not create the station' }, { status: 500 })
  }
  await localDb.from('users').update({ org_id: LOCAL_STATION_ID }).eq('id', owner.id)

  setSessionUserId(owner.id)
  return NextResponse.json({ ok: true, stationId: LOCAL_STATION_ID, onboardingComplete: false })
}
