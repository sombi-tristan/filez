import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/entryHelpers'
import { rateLimit } from '@/lib/rateLimit'
import { createDevice, signLicence, stationHasRecords } from '@/lib/desktop'
import { SYNC_TABLES } from '@/lib/desktopTables'
import { createOwnedStation } from '@/lib/newStation'

/**
 * Links a StationMGR Desktop computer to one of the owner's web stations. The one step a
 * computer needs the internet for before it can work offline.
 *
 * POST { email, password, deviceName, stationId? }
 *   - the owner's web sign-in, checked here against Supabase Auth; never stored
 *   - without stationId: the stations they own, as a list to choose from (even one: the owner
 *     always picks), and the computer asks again with stationId
 *   - with stationId: { token, licence, station, owner, hasRecords }. The token is shown once.
 *     hasRecords says whether the station has records here already, so a computer with its own
 *     can ask which to keep without pulling (a pull needs a subscription).
 *   - with createName instead: a new station owned by them (lib/newStation.js), linked the same
 *     way, for a computer whose records have no station on the web yet. It has no
 *     subscription, so they go up with the first push once one is running.
 *
 * Only a station's owner can link a computer to it; staff sign in on the computer with PINs.
 */
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`desktop-link:${ip}`, 20).success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
    }

    const { email, password, deviceName, stationId, createName } = await request.json().catch(() => ({}))
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({ email: String(email).trim(), password: String(password) })
    if (signInError || !signedIn?.user) return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    // The session was only needed to prove the password; nothing is kept. Only it ends: the
    // default signs the account out everywhere, the owner's phone with it.
    auth.auth.signOut({ scope: 'local' }).catch(() => {})

    const supabase = getServiceClient()
    const { data: owner } = await supabase.from('users').select('id, name, email').eq('id', signedIn.user.id).maybeSingle()
    if (!owner) return NextResponse.json({ error: 'No StationMGR account for this sign-in' }, { status: 403 })

    let created = null
    if (createName !== undefined) {
      const res = await createOwnedStation(supabase, { ownerId: owner.id, name: createName })
      if (res.error) return NextResponse.json({ error: res.error }, { status: 400 })
      created = res.station
    }

    const { data: stations } = created ? { data: [created] } : await supabase
      .from('organizations')
      .select('id, name, location')
      .eq('owner_id', owner.id)
      .order('name')
    if (!stations?.length) {
      return NextResponse.json({ error: 'This account owns no station yet. Create one for this computer instead.', canCreate: true }, { status: 403 })
    }

    // Always the owner's choice: even a single station is listed, never linked on its own.
    const chosen = created || (stationId ? stations.find((s) => s.id === stationId) : null)
    if (!chosen) {
      if (stationId) return NextResponse.json({ error: 'You do not own that station' }, { status: 403 })
      return NextResponse.json({ stations: stations.map(({ id, name, location }) => ({ id, name, location })) })
    }

    const { deviceId, token } = await createDevice({ orgId: chosen.id, userId: owner.id, name: deviceName })
    const licence = await signLicence({ orgId: chosen.id, deviceId, stationName: chosen.name })
    return NextResponse.json({
      token,
      licence,
      station: { id: chosen.id, name: chosen.name, location: chosen.location || '' },
      owner: { id: owner.id, name: owner.name || '', email: owner.email || '' },
      hasRecords: await stationHasRecords(chosen.id, Object.keys(SYNC_TABLES)),
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message === 'DESKTOP_LICENCE_PRIVATE_KEY is not set' ? 'Desktop linking is not set up on the server yet' : 'Server error' }, { status: 500 })
  }
}
