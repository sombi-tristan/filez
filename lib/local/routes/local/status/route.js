import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { LOCAL_STATION_ID } from '@/lib/local/constants'

// GET — what the sign-in screen needs: is the app set up yet, and who can sign in.
export async function GET() {
  const { data: station } = await localDb.from('organizations').select('id, name, owner_id, onboarding_complete').eq('id', LOCAL_STATION_ID).maybeSingle()
  const { data: users } = await localDb.from('users').select('id, name, email, pin_hash, disabled').order('name')
  const people = (users || [])
    .filter((u) => u.pin_hash && !u.disabled)
    .map((u) => ({ id: u.id, name: u.name, username: u.email, isOwner: u.id === station?.owner_id }))
    .sort((a, b) => Number(b.isOwner) - Number(a.isOwner))
  return NextResponse.json({
    setupDone: !!station,
    stationId: LOCAL_STATION_ID,
    stationName: station?.name || '',
    onboardingComplete: !!station?.onboarding_complete,
    users: people,
  })
}
