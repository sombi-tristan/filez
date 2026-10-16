import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { store } from '@/lib/local/store'
import { getLink } from '@/lib/local/link'
import { hashPin } from '@/lib/local/pin'
import { setSessionUserId } from '@/lib/local/session'

// POST — first run, after this computer is linked to its web station: the owner chooses the
// username and PIN they will sign in with here, and is signed in.
//
// The owner's account here takes the web owner's id, so the station rows pulled from the web
// (organizations.owner_id) already point at it. The station row comes from the pull; it is only
// made here if the pull had not brought it.
export async function POST(request) {
  const link = getLink()
  if (!link?.stationId) return NextResponse.json({ error: 'Link this computer to your station first' }, { status: 400 })

  const { data: users } = await localDb.from('users').select('id, pin_hash')
  if ((users || []).some((u) => u.pin_hash)) return NextResponse.json({ error: 'This computer is already set up' }, { status: 409 })

  const { ownerName, username, pin } = await request.json()
  const login = String(username || '').trim().toLowerCase()
  if (!ownerName?.trim()) return NextResponse.json({ error: 'Your name is required' }, { status: 400 })
  if (!/^[a-z0-9._-]{2,32}$/.test(login)) return NextResponse.json({ error: 'Username: 2-32 letters, numbers, dots, dashes or underscores' }, { status: 400 })
  if (!/^\d{4,8}$/.test(String(pin || ''))) return NextResponse.json({ error: 'PIN must be 4 to 8 digits' }, { status: 400 })

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
