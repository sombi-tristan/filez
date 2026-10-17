import { NextResponse } from '@/lib/local/nextServer'
import { store, TABLES, columnsOf, uuid } from '@/lib/local/store'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { getAuthUser } from '@/lib/supabaseServer'
import { allLinks, getCurrentStationId, getLink } from '@/lib/local/link'
import { markReplaceWeb } from '@/lib/local/webSync'
import { restoreIntoPlan, summarize, RESTORE_TABLES } from '@/lib/local/restoreInto'
import { recordChanges } from '@/lib/local/outbox'
import { checkLicence, paidNow } from '@/lib/local/licence'
import { clearLocalData } from '@/lib/initialSync'

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

// POST { backup, preview } — what restoring it into the station would do, for the warning:
// lib/local/restoreInto.js summarize.
// POST { backup, mode } — restore it into the station open now (or { stationId }), whichever
// station the backup came from: 'overwrite' makes the station exactly the backup, 'pad' keeps
// what the station has and adds what is missing (lib/local/restoreInto.js). The station's name,
// link and owner stay. Every row written is recorded for a push, and on overwrite every row
// removed is too, so a linked station's web copy follows.
export async function POST(request) {
  const me = await getAuthUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await anyPaid())) return NextResponse.json({ error: 'Restoring a backup needs a subscription running' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const backup = body?.backup
  if (backup?.format !== FORMAT || !backup.tables?.organizations?.length) {
    return NextResponse.json({ error: 'That file is not a StationMGR backup' }, { status: 400 })
  }
  const stationId = body.stationId || getCurrentStationId()
  const station = await store.organizations.get(stationId)
  if (!station || station.owner_id !== me.id) return NextResponse.json({ error: 'Only the station\'s owner can restore into it' }, { status: 403 })

  const here = {}
  for (const t of RESTORE_TABLES) here[t] = await store[t].where('org_id').equals(stationId).toArray()
  if (body.preview) return NextResponse.json({ summary: summarize(backup, here) })
  if (body.mode !== 'overwrite' && body.mode !== 'pad') return NextResponse.json({ error: 'Choose overwrite or pad' }, { status: 400 })

  const { puts, deletes } = restoreIntoPlan({ backup, here, mode: body.mode, stationId, newId: uuid })
  const removed = {}
  await store.transaction('rw', [...RESTORE_TABLES, 'organizations', 'files'].map((t) => store[t]), async () => {
    for (const t of RESTORE_TABLES) {
      if (deletes[t].length) {
        removed[t] = here[t].filter((r) => deletes[t].includes(r.id))
        await store[t].bulkDelete(deletes[t])
      }
      if (puts[t].length) await store[t].bulkPut(puts[t])
    }
    // Files the entries point at (imprest receipts) come in as they are; their paths are the backup's.
    if (backup.tables.files?.length) await store.files.bulkPut(backup.tables.files)
    // Restored, the station's setup is done when the backup's was.
    if (backup.tables.organizations[0].onboarding_complete && !station.onboarding_complete) {
      await store.organizations.put({ ...station, onboarding_complete: true })
    }
  })
  for (const t of RESTORE_TABLES) {
    if (removed[t]?.length) await recordChanges(t, removed[t], 'delete')
    if (puts[t].length) await recordChanges(t, puts[t], 'upsert')
  }

  // A restore is a correction: on a linked station the web copy is replaced by this one, and no
  // pull brings the web's old rows back first (lib/local/webSync.js replaceWeb).
  if (getLink(stationId)) markReplaceWeb(stationId)

  // The screens read a mirror of the store (lib/db.js): the station's is rebuilt on opening.
  await clearLocalData(stationId).catch(() => {})
  const counts = Object.fromEntries(RESTORE_TABLES.map((t) => [t, { added: puts[t].length, removed: deletes[t].length }]))
  return NextResponse.json({ ok: true, counts, station: { id: stationId, name: station.name, onboarding_complete: true } })
}
