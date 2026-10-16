import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/entryHelpers'
import { authenticateDevice, signLicence } from '@/lib/desktop'
import { SYNC_TABLES } from '@/lib/desktopTables'

const PAGE = 1000

/** Every row of `table` for the station, a page at a time (Supabase returns 1000 at most). */
async function allRows(supabase, table, orgId) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*').range(from, from + PAGE - 1).order('id')
    query = table === 'organizations' ? query.eq('id', orgId) : query.eq('org_id', orgId)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < PAGE) return rows
  }
}

/**
 * The linked station's records, for a desktop computer's Pull: GET with
 * `Authorization: Device <token>`. One request returns every synced table (lib/desktopTables.js)
 * in full, deleted entries included so the computer learns of deletions, and a fresh licence.
 *
 * Reads need no subscription, as on the web: a lapsed station can still pull its own data.
 */
export async function GET(request) {
  try {
    const linked = await authenticateDevice(request)
    if (!linked) return NextResponse.json({ error: 'This computer is not linked' }, { status: 401 })

    const supabase = getServiceClient()
    const orgId = linked.station.id
    const tables = Object.keys(SYNC_TABLES)
    const results = await Promise.all(tables.map((t) => allRows(supabase, t, orgId)))
    const rows = Object.fromEntries(tables.map((t, i) => [t, results[i]]))

    const licence = await signLicence({ orgId, deviceId: linked.device.id, stationName: linked.station.name })
    return NextResponse.json({ station: { id: orgId, name: linked.station.name }, rows, serverTime: new Date().toISOString(), licence })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
