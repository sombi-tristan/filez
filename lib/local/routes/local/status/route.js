import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { getLink, getLinkedStationId } from '@/lib/local/link'
import { store } from '@/lib/local/store'
import { heldStation } from '@/lib/local/restorePlan'

// GET — what the sign-in screen needs: is this computer linked to a web station, does it have
// an owner with a PIN yet, and who can sign in.
export async function GET() {
  const stationId = getLinkedStationId()
  const link = getLink()
  const { data: station } = await localDb.from('organizations').select('id, name, owner_id, onboarding_complete').eq('id', stationId).maybeSingle()
  const { data: users } = await localDb.from('users').select('id, name, email, pin_hash, disabled').order('name')
  // Records of another station than the linked one (an earlier restore): sign-in offers the way
  // out (lib/local/routes/local/rescue), and that station's owner is the one who chooses.
  const held = heldStation({ stationId, linked: Boolean(link?.stationId), stations: await store.organizations.toArray() })
  const ownerId = (held || station)?.owner_id
  const people = (users || [])
    .filter((u) => u.pin_hash && !u.disabled)
    .map((u) => ({ id: u.id, name: u.name, username: u.email, isOwner: u.id === ownerId }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
  return NextResponse.json({
    linked: Boolean(link?.stationId),
    link: link ? { stationName: link.stationName, ownerName: link.ownerName, ownerEmail: link.ownerEmail } : null,
    // Someone can sign in: a computer linked but with no PIN yet goes on to create the owner's.
    setupDone: people.length > 0,
    stationId,
    stationName: station?.name || link?.stationName || '',
    onboardingComplete: !!station?.onboarding_complete,
    heldStation: held ? { id: held.id, name: held.name } : null,
    users: people,
  })
}
