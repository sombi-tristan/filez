import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { getLink, getCurrentStationId } from '@/lib/local/link'
import { store } from '@/lib/local/store'

// GET — what the sign-in screen needs: whether anyone can sign in yet, who, and for a first run
// whether this computer was linked to a web station first. A computer holds several stations;
// after signing in each person picks among the ones they may open (screens/dashboard/page.js).
export async function GET() {
  const stationId = getCurrentStationId()
  const link = getLink()
  const { data: station } = await localDb.from('organizations').select('id, name, owner_id, onboarding_complete').eq('id', stationId).maybeSingle()
  const { data: users } = await localDb.from('users').select('id, name, email, pin_hash, disabled').order('name')
  const stations = await store.organizations.toArray()
  const owners = new Set(stations.map((s) => s.owner_id))
  const people = (users || [])
    .filter((u) => u.pin_hash && !u.disabled)
    .map((u) => ({ id: u.id, name: u.name, username: u.email, isOwner: owners.has(u.id) }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
  return NextResponse.json({
    linked: Boolean(link?.stationId),
    link: link ? { stationName: link.stationName, ownerName: link.ownerName, ownerEmail: link.ownerEmail } : null,
    // Someone can sign in: a computer linked but with no PIN yet goes on to create the owner's.
    setupDone: people.length > 0,
    stationId,
    // With several stations the sign-in is the computer's, not one station's.
    stationName: stations.length > 1 ? 'StationMGR' : (station?.name || link?.stationName || ''),
    onboardingComplete: !!station?.onboarding_complete,
    users: people,
  })
}
