import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { getLink, getLinkedStationId } from '@/lib/local/link'

// GET — what the sign-in screen needs: is this computer linked to a web station, does it have
// an owner with a PIN yet, and who can sign in.
export async function GET() {
  const stationId = getLinkedStationId()
  const link = getLink()
  const { data: station } = await localDb.from('organizations').select('id, name, owner_id, onboarding_complete').eq('id', stationId).maybeSingle()
  const { data: users } = await localDb.from('users').select('id, name, email, pin_hash, disabled').order('name')
  const people = (users || [])
    .filter((u) => u.pin_hash && !u.disabled)
    .map((u) => ({ id: u.id, name: u.name, username: u.email, isOwner: u.id === station?.owner_id }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
  return NextResponse.json({
    linked: Boolean(link?.stationId),
    link: link ? { stationName: link.stationName, ownerName: link.ownerName, ownerEmail: link.ownerEmail } : null,
    // Someone can sign in: a computer linked but with no PIN yet goes on to create the owner's.
    setupDone: people.length > 0,
    stationId,
    stationName: station?.name || link?.stationName || '',
    onboardingComplete: !!station?.onboarding_complete,
    users: people,
  })
}
