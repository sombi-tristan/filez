import { NextResponse } from '@/lib/local/nextServer'
import { store, TABLES, columnsOf } from '@/lib/local/store'
import { db } from '@/lib/db'
import { getLink, setLink } from '@/lib/local/link'
import { LOCAL_STATION_ID } from '@/lib/local/constants'
import { heldStation } from '@/lib/local/restorePlan'
import { getSessionUserId, clearSession } from '@/lib/local/session'
import { checkLicence } from '@/lib/local/licence'
import { moveStation, pull } from '@/lib/local/webSync'
import { unlinkComputer } from '@/lib/local/web'

// POST { keep } — the way out for a linked computer that holds another station's records (an
// earlier restore could leave it so; lib/local/restorePlan.js heldStation). Only the held
// station's owner, signed in, may choose:
//
//   keep: 'web'   clear this computer and get the linked station back from the web (its
//                 records come down with a subscription running); the owner then sets a PIN
//   keep: 'held'  keep the held station's records and unlink, as a computer that was never
//                 linked; it can be linked to that station later
export async function POST(request) {
  const link = getLink()
  const held = heldStation({ stationId: link?.stationId, linked: Boolean(link?.stationId), stations: await store.organizations.toArray() })
  if (!held) return NextResponse.json({ error: 'This computer holds the station it is linked to' }, { status: 409 })
  if (!getSessionUserId() || getSessionUserId() !== held.owner_id) {
    return NextResponse.json({ error: `Only the owner of ${held.name || 'this station'} can choose` }, { status: 403 })
  }

  const { keep } = await request.json().catch(() => ({}))
  if (keep === 'web') {
    const names = [...TABLES, 'files', 'outbox']
    await store.transaction('rw', names.map((t) => store[t]), async () => {
      for (const t of names) await store[t].clear()
    })
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) await t.clear()
    })
    clearSession()
    await checkLicence()
    const pulled = await pull({ rebuild: true })
    return NextResponse.json({ ok: true, pulled: Boolean(pulled.ok), error: pulled.ok ? null : pulled.error })
  }
  if (keep === 'held') {
    // What a pull brought down of the linked station is not this computer's any more.
    await dropStation(link.stationId)
    await moveStation([held.id], LOCAL_STATION_ID)
    await db.transaction('rw', db.tables, async () => {
      for (const t of db.tables) await t.clear()
    })
    await unlinkComputer()
    setLink(null)
    await checkLicence()
    return NextResponse.json({ ok: true, stationId: LOCAL_STATION_ID })
  }
  return NextResponse.json({ error: 'Choose web or held' }, { status: 400 })
}

/** Removes a station's row and every record of it from the local store, and its pending pushes. */
async function dropStation(stationId) {
  await store.organizations.delete(stationId)
  for (const table of TABLES) {
    // People stay: the one choosing is signed in, and staff belong to the station kept.
    if (table === 'organizations' || table === 'users' || !columnsOf(table).includes('org_id')) continue
    await store[table].where('org_id').equals(stationId).delete()
  }
  await store.outbox.clear()
}
