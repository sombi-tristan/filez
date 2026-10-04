import { NextResponse } from '@/lib/local/nextServer'
import { store, TABLES } from '@/lib/local/store'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { getAuthUser } from '@/lib/supabaseServer'
import { LOCAL_STATION_ID } from '@/lib/local/constants'

const FORMAT = 'stationmgr-backup'

async function requireOwner() {
  const me = await getAuthUser()
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const station = await store.organizations.get(LOCAL_STATION_ID)
  if (station?.owner_id !== me.id) return { error: NextResponse.json({ error: 'Only the owner can back up or restore' }, { status: 403 }) }
  return { me }
}

// GET — everything on this computer as one JSON document.
export async function GET() {
  const { error } = await requireOwner()
  if (error) return error

  // Push anything still waiting in the sync queue into the store first, so the backup holds
  // the entry that was saved a second ago.
  try { await processQueue() } catch { /* nothing pending */ }
  const pending = await db.syncQueue.count()

  const tables = {}
  for (const t of [...TABLES, 'files']) tables[t] = await store[t].toArray()
  return NextResponse.json({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), pendingNotIncluded: pending, tables })
}

// POST — replace everything on this computer with a backup.
export async function POST(request) {
  const { error } = await requireOwner()
  if (error) return error

  let backup
  try { backup = await request.json() } catch { return NextResponse.json({ error: 'That file is not a backup' }, { status: 400 }) }
  if (backup?.format !== FORMAT || !backup.tables?.organizations?.length) {
    return NextResponse.json({ error: 'That file is not a StationMGR backup' }, { status: 400 })
  }

  const names = [...TABLES, 'files']
  await store.transaction('rw', names.map((t) => store[t]), async () => {
    for (const t of names) {
      await store[t].clear()
      const rows = backup.tables[t] || []
      if (rows.length) await store[t].bulkPut(rows)
    }
  })

  // The screens read a mirror of the store (lib/db.js). Empty it so it is rebuilt from the
  // restored data on the next screen that opens.
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })

  return NextResponse.json({ ok: true })
}
