import { NextResponse } from '@/lib/local/nextServer'
import { store, TABLES, columnsOf, uuid } from '@/lib/local/store'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { getAuthUser } from '@/lib/supabaseServer'
import { allLinks, getLink, getCurrentStationId } from '@/lib/local/link'
import { restorePlan } from '@/lib/local/restorePlan'
import { markEverythingChanged, pendingChanges } from '@/lib/local/outbox'
import { checkLicence, paidNow } from '@/lib/local/licence'
import { clearLocalData } from '@/lib/initialSync'
import { canAddStations } from '@/lib/local/accounts'

const FORMAT = 'stationmgr-backup'

// A station's records: every table that notes its station, but people (users) are kept apart.
const STATION_TABLES = TABLES.filter((t) => t !== 'users' && t !== 'organizations' && columnsOf(t).includes('org_id'))
const ofStation = (stationId) => (f) => f.id.includes(stationId)

/** Backups and restores need a subscription running on a station here (any one of them). */
async function anyPaid() {
  for (const { stationId } of allLinks()) {
    await checkLicence(Date.now(), stationId)
    if (paidNow(stationId)) return true
  }
  return false
}

// GET — the station open now as one JSON document: its row, its records, its staff and owner.
export async function GET() {
  const me = await getAuthUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const stationId = getCurrentStationId()
  const station = await store.organizations.get(stationId)
  if (!station || station.owner_id !== me.id) return NextResponse.json({ error: 'Only the owner can back up a station' }, { status: 403 })
  if (!(await anyPaid())) return NextResponse.json({ error: 'Backing up needs a subscription running' }, { status: 403 })

  // Push anything still waiting in the sync queue into the store first, so the backup holds
  // the entry that was saved a second ago.
  try { await processQueue() } catch { /* nothing pending */ }
  const pending = await db.syncQueue.count()

  const tables = { organizations: [station] }
  for (const t of STATION_TABLES) tables[t] = await store[t].where('org_id').equals(stationId).toArray()
  const staffEmails = new Set((tables.org_invites || []).map((i) => i.email))
  tables.users = (await store.users.toArray()).filter((u) => u.id === station.owner_id || u.org_id === stationId || staffEmails.has(u.email))
  tables.files = (await store.files.toArray()).filter(ofStation(stationId))
  return NextResponse.json({ format: FORMAT, version: 2, exportedAt: new Date().toISOString(), pendingNotIncluded: pending, tables })
}

// POST — a backup becomes a station on this computer: added beside the others, or replacing
// only that same station (lib/local/restorePlan.js). Its setup and opening balances come in
// exactly as they are in the backup, once. Other stations are never touched. The person
// restoring owns it here.
export async function POST(request) {
  const me = await getAuthUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAddStations(me.id))) return NextResponse.json({ error: 'Staff cannot restore a backup' }, { status: 403 })
  if (!(await anyPaid())) return NextResponse.json({ error: 'Restoring a backup needs a subscription running' }, { status: 403 })

  let backup
  try { backup = await request.json() } catch { return NextResponse.json({ error: 'That file is not a backup' }, { status: 400 }) }
  if (backup?.format !== FORMAT || !backup.tables?.organizations?.length) {
    return NextResponse.json({ error: 'That file is not a StationMGR backup' }, { status: 400 })
  }

  // Decided before anything is written.
  const here = []
  for (const s of await store.organizations.toArray()) {
    const pumps = [...await store.station_pumps.where('org_id').equals(s.id).toArray(), ...await store.station_tanks.where('org_id').equals(s.id).toArray()]
    here.push({ id: s.id, pumps: pumps.map((r) => r.id) })
  }
  const plan = restorePlan(backup, { here })
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 409 })
  const from = backup.tables.organizations[0]
  const into = plan.fresh ? uuid() : plan.into
  const move = (row) => (row.org_id === from.id ? { ...row, org_id: into } : row)

  const names = ['organizations', 'users', 'files', ...STATION_TABLES]
  await store.transaction('rw', names.map((t) => store[t]), async () => {
    if (plan.replace) {
      for (const t of STATION_TABLES) await store[t].where('org_id').equals(into).delete()
      await store.files.filter(ofStation(into)).delete()
    }
    await store.organizations.put({ ...from, id: into, owner_id: me.id })
    for (const t of STATION_TABLES) {
      const rows = (backup.tables[t] || []).map(move)
      if (rows.length) await store[t].bulkPut(rows)
    }
    // People: those not here yet come in with their PINs; a username already here keeps its own
    // account (staff reach the station through their invite, which names the username).
    for (const u of backup.tables.users || []) {
      if (await store.users.get(u.id)) continue
      if (await store.users.where('id').notEqual(u.id).filter((x) => x.email === u.email).count()) continue
      await store.users.put(move(u))
    }
    for (const f of backup.tables.files || []) await store.files.put({ ...f, id: f.id.split(from.id).join(into) })
  })

  // What waited to go up for that station is replaced; on a linked one it all goes up again.
  const stale = await pendingChanges(into)
  await store.outbox.bulkDelete(stale.map((c) => c.key))
  if (getLink(into)) await markEverythingChanged(into)

  // The screens read a mirror of the store (lib/db.js): that station's is rebuilt on opening.
  await clearLocalData(into).catch(() => {})

  return NextResponse.json({ ok: true, station: { id: into, name: from.name || 'Station', onboarding_complete: from.onboarding_complete !== false } })
}
