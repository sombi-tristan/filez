import { NextResponse } from '@/lib/local/nextServer'
import { store, uuid } from '@/lib/local/store'
import { getSessionUserId } from '@/lib/local/session'

// POST { name } — a new station on this computer, offline: owned by the person signed in, who
// must own a station here already (staff cannot add stations). It opens on the setup wizard,
// where its pumps, tanks and opening balances are entered; it can be linked to the web later.
//
// POST { claim } — the person signed in takes over a station here whose owner is nobody on this
// computer (a pull brought it down after an old restore), with its records.
export async function POST(request) {
  const me = getSessionUserId()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const owned = await store.organizations.filter((o) => o.owner_id === me).count()
  if (!owned) return NextResponse.json({ error: 'Only a station owner can add a station' }, { status: 403 })

  const { name, claim } = await request.json().catch(() => ({}))
  if (claim) {
    const station = await store.organizations.get(claim)
    if (!station) return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    if (await store.users.get(station.owner_id)) return NextResponse.json({ error: 'That station has an owner here' }, { status: 409 })
    await store.organizations.put({ ...station, owner_id: me })
    return NextResponse.json({ station: { ...station, owner_id: me } })
  }
  const clean = String(name || '').trim()
  if (!clean || clean.length > 100) return NextResponse.json({ error: 'Station name is required (max 100 characters)' }, { status: 400 })

  const station = {
    id: uuid(),
    name: clean,
    slug: 'station',
    owner_id: me,
    onboarding_complete: false,
    created_at: new Date().toISOString(),
  }
  await store.organizations.put(station)
  return NextResponse.json({ station })
}
