import { NextResponse } from '@/lib/local/nextServer'
import { store, TABLES } from '@/lib/local/store'
import { db } from '@/lib/db'
import { processQueue } from '@/lib/sync'
import { getAuthUser } from '@/lib/supabaseServer'
import { getLink, setLink, getLinkedStationId } from '@/lib/local/link'
import { restorePlan } from '@/lib/local/restorePlan'
import { moveStation } from '@/lib/local/webSync'
import { markEverythingChanged } from '@/lib/local/outbox'
import { unlinkComputer } from '@/lib/local/web'
import { checkLicence } from '@/lib/local/licence'

const FORMAT = 'stationmgr-backup'

async function requireOwner() {
  const me = await getAuthUser()
  if (!me) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const station = await store.organizations.get(getLinkedStationId())
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

// POST — replace everything on this computer with a backup, its setup and opening balances
// included (lib/local/restorePlan.js).
export async function POST(request) {
  const { error } = await requireOwner()
  if (error) return error

  let backup
  try { backup = await request.json() } catch { return NextResponse.json({ error: 'That file is not a backup' }, { status: 400 }) }
  if (backup?.format !== FORMAT || !backup.tables?.organizations?.length) {
    return NextResponse.json({ error: 'That file is not a StationMGR backup' }, { status: 400 })
  }
  // Decided before anything is wiped.
  const stationId = getLinkedStationId()
  const linked = Boolean(getLink()?.stationId)
  const plan = restorePlan(backup, { stationId, linked })
  if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 409 })

  const names = [...TABLES, 'files']
  await store.transaction('rw', names.map((t) => store[t]), async () => {
    for (const t of names) {
      await store[t].clear()
      const rows = backup.tables[t] || []
      if (rows.length) await store[t].bulkPut(rows)
    }
  })
  // A backup made before linking (or restored on a computer not linked) moves into the station
  // this computer works on; on a linked one its records then go up with the next push.
  if (plan.adoptFrom) {
    const hadRecords = await moveStation([plan.adoptFrom], plan.into)
    if (linked && !plan.unlink && hadRecords) await markEverythingChanged()
  }
  // A backup of another station: this computer is no longer the linked station's. It works
  // offline as the restored one, and sign-in offers to create (or link) it on the web.
  if (plan.unlink) {
    await store.outbox.clear()
    await unlinkComputer()
    setLink(null)
    await checkLicence()
  }

  // The screens read a mirror of the store (lib/db.js). Empty it so it is rebuilt from the
  // restored data on the next screen that opens.
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })

  return NextResponse.json({ ok: true, unlinked: Boolean(plan.unlink), stationName: backup.tables.organizations[0].name || '' })
}
