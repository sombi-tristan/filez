import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess, canAdministerStation } from '@/lib/stationAccess'

// GET — station manager lists invites for a station
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    if (!orgId) {
      return NextResponse.json({ error: 'org_id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Owner or platform admin. Not ordinary staff: the invite list names everyone with
    // access to the station, which is the owner's business and an admin's, not a member's.
    // A read, so nothing is logged.
    const { ok, via } = await hasStationAccess(user, orgId)
    if (!ok || !canAdministerStation(via)) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    const { data: invites } = await supabase
      .from('org_invites')
      .select('id, email, status, invited_at, visible_pages')
      .eq('org_id', orgId)
      .order('invited_at', { ascending: false })

    // Desktop build: staff are local users; attach their display names to the list.
    const { data: people } = await supabase.from('users').select('email, name')
    const names = new Map((people || []).map((p) => [p.email, p.name]))
    return NextResponse.json({ invites: (invites || []).map((i) => ({ ...i, name: names.get(i.email) || '' })) })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
