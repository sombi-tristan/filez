import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess } from '@/lib/stationAccess'
import { rateLimit } from '@/lib/rateLimit'

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET — list stations the user manages, or ?org_id= for one specific station.
//
// The single-station form exists for the setup wizard. It lists only OWNED and member
// stations, so an admin running setup on someone's behalf found no station in the list:
// no name, no existing location, and — the dangerous part — the `onboarding_complete`
// guard silently never fired, so they could re-run setup over a live station's tank and
// nozzle configuration. Asking for the station by id restores that guard for admins.
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const orgId = request?.url ? new URL(request.url).searchParams.get('org_id') : null
    if (orgId) {
      const { ok } = await hasStationAccess(user, orgId)
      if (!ok) return NextResponse.json({ error: 'Station not found' }, { status: 404 })

      const { data: station } = await supabase
        .from('organizations').select('*, station_groups(name)').eq('id', orgId).maybeSingle()
      // Returned under `stations` so callers can read it the same way as the list form.
      return NextResponse.json({ stations: station ? [withGroupName(station)] : [], memberStations: [] })
    }
    const { data: stations } = await supabase
      .from('organizations')
      .select('*, station_groups(name)')
      .eq('owner_id', user.id)
      .order('created_at')

    // Fetch stations the user is a member of (via accepted invites, not owner)
    const { data: invites } = await supabase
      .from('org_invites')
      .select('org_id, organizations(id, name, slug, location, onboarding_complete)')
      .eq('email', user.email)
      .eq('status', 'accepted')

    const ownedIds = new Set((stations || []).map(s => s.id))
    const memberStations = (invites || [])
      .map(i => i.organizations)
      .filter(Boolean)
      .filter(org => !ownedIds.has(org.id))

    return NextResponse.json({ stations: (stations || []).map(withGroupName), memberStations })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * Flatten the embedded group onto the shape callers already read.
 *
 * organizations still carries the old station_group TEXT column, which migration 054 left in
 * place but application code no longer writes. Returning the row untouched would hand callers
 * that stale text; this replaces it with the joined name, so `station_group` keeps meaning
 * "the group's name" and nothing downstream had to change.
 */
function withGroupName(station) {
  if (!station) return station
  const { station_groups, ...rest } = station
  return { ...rest, station_group: station_groups?.name || null }
}

// POST — create a new station
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { name } = await request.json()
    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Generate unique slug
    let slug = slugify(name)
    if (!slug) slug = 'station'
    const { data: slugCheck } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single()

    if (slugCheck) {
      slug = `${slug}-${Date.now().toString(36)}`
    }

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), slug, owner_id: user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create station' }, { status: 500 })
    }

    // Set org_id on the owner's user record
    await supabase
      .from('users')
      .update({ org_id: org.id })
      .eq('id', user.id)

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH — update a station
export async function PATCH(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`org:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { id, name } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    if (!name || name.trim().length < 1 || name.length > 100) {
      return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: org, error } = await supabase
      .from('organizations')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to update station' }, { status: 500 })
    }

    return NextResponse.json({ org })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — delete a station
export async function DELETE(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete station' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
