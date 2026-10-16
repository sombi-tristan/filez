import { store, TABLES, columnsOf } from './store'
import { pendingChanges, clearChanges, markEverythingChanged } from './outbox'
import { getLink, setLink, updateLink } from './link'
import { saveLicence, checkLicence, paidNow } from './licence'
import { linkComputer, webGet, webPost } from './web'
import { LOCAL_STATION_ID } from './constants'
import { getSessionUserId } from './session'
import { SYNC_TABLES, PUSH_ORDER, PUSH_BATCH } from '@/lib/desktopTables'
import { processQueue } from '@/lib/sync'
import { initialSync, clearLocalData } from '@/lib/initialSync'

/**
 * Push, pull and linking between this computer and its web station (app/api/desktop/* on the
 * web). The computer works offline; these are the moments it reaches the web, and each one
 * brings back a fresh licence.
 *
 * Push and Pull are paid: they need the station to have any service running (lib/local/licence.js
 * paidNow; the web checks it again). Linking itself is free.
 *
 * Push and Pull start by flushing the screens' own queue (lib/sync.js) into the in-app server,
 * so what was just typed is in the local store before anything moves.
 */

const message = (res, fallback) => res?.body?.error || fallback

/**
 * Why a push, pull or licence check failed. A 401 means the web no longer knows this computer:
 * its owner revoked it (Linked computers, on the web). It is marked, so the screens offer to
 * link it again; linking afresh clears the mark.
 */
function failure(res, fallback) {
  if (res?.status === 401) {
    updateLink({ revoked: true })
    return 'This computer was unlinked from its station on the web. Link it again to sync.'
  }
  return message(res, fallback)
}

/** The licence a response carries, kept if it verifies. */
async function keepLicence(res) {
  if (res?.body?.licence) await saveLicence(res.body.licence).catch(() => {})
}

const UNPAID = 'Push and Pull need the station to have a subscription running'

// Push and pull take turns, whoever starts them: the buttons on the station page or the
// automatic sync (components/desktop/AutoSync.js). Each waits for the one before it.
let turn = Promise.resolve()
function inTurn(fn) {
  const run = turn.then(fn, fn)
  turn = run.catch(() => {})
  return run
}

/** Refresh the licence alone, so a renewed subscription unlocks the app without a push or pull. */
export async function refreshLicence() {
  const res = await webGet('/api/desktop/licence')
  if (!res.ok) return { ok: false, error: failure(res, 'Could not check the subscription') }
  await keepLicence(res)
  return { ok: true }
}

/**
 * Sends every change this computer has made since the last push, in batches, in table order so
 * a row arrives after the rows it points at. Rows the web refuses stay waiting and are listed.
 */
export function push() {
  return inTurn(pushNow)
}

async function pushNow() {
  const link = getLink()
  if (!link) return { ok: false, error: 'This computer is not linked to a web station' }
  if (!paidNow()) return { ok: false, unpaid: true, error: UNPAID }
  await processQueue()

  const rank = (t) => PUSH_ORDER.indexOf(t)
  const changes = (await pendingChanges()).sort((a, b) => rank(a.table) - rank(b.table) || a.at - b.at)
  let pushed = 0
  const refused = []

  for (let i = 0; i < changes.length; i += PUSH_BATCH) {
    const batch = changes.slice(i, i + PUSH_BATCH)
    const payload = await Promise.all(batch.map(async (c) => {
      const row = c.op === 'upsert' ? await store[c.table].get(c.id) : null
      return row ? { table: c.table, op: 'upsert', id: c.id, row } : { table: c.table, op: 'delete', id: c.id }
    }))
    const res = await webPost('/api/desktop/push', { changes: payload })
    // A refused push still carries a fresh licence: a lapsed subscription is known at once.
    await keepLicence(res)
    if (!res.ok) return { ok: false, pushed, refused, error: failure(res, 'Push failed') }

    const results = res.body.results || []
    const accepted = batch.filter((c, k) => results[k]?.ok)
    batch.forEach((c, k) => { if (!results[k]?.ok) refused.push({ table: c.table, id: c.id, error: results[k]?.error || 'Refused' }) })
    await clearChanges(accepted)
    pushed += accepted.length
  }

  updateLink({ lastPushAt: new Date().toISOString() })
  return { ok: true, pushed, refused }
}

/**
 * Brings the web station's records onto this computer. A row still waiting to be pushed keeps
 * its local version; a row the web no longer has is removed here unless it is waiting too.
 * Then the screens' copy (lib/db.js) is rebuilt from the local store.
 */
export function pull(options) {
  return inTurn(() => pullNow(options))
}

async function pullNow({ rebuild = false } = {}) {
  const link = getLink()
  if (!link) return { ok: false, error: 'This computer is not linked to a web station' }
  if (!paidNow()) return { ok: false, unpaid: true, error: UNPAID }
  await processQueue()

  const res = await webGet('/api/desktop/pull')
  await keepLicence(res)
  if (!res.ok) return { ok: false, error: failure(res, 'Pull failed') }

  const { counts, changed } = await applyPulledRows(link.stationId, res.body.rows || {})
  // The screens' copy is read through the in-app server, which answers signed-in people only.
  // On first run nobody is yet: the screens build it themselves once someone signs in. A pull
  // that changed nothing here leaves it as it is.
  if ((changed || rebuild) && getSessionUserId()) await initialSync(link.stationId, { force: true })
  updateLink({ lastPullAt: new Date().toISOString(), stationName: res.body.station?.name || link.stationName })
  return { ok: true, counts, changed }
}

async function applyPulledRows(stationId, rows) {
  const waiting = new Set((await pendingChanges()).map((c) => c.key))
  const counts = {}
  let changed = 0
  for (const table of Object.keys(SYNC_TABLES)) {
    const columns = columnsOf(table)
    const keepColumns = (row) => (columns.length ? Object.fromEntries(Object.entries(row).filter(([k]) => columns.includes(k))) : row)
    const incoming = (rows[table] || []).filter((r) => r && r.id)
    const here = table === 'organizations'
      ? await store.organizations.where('id').equals(stationId).toArray()
      : await store[table].where('org_id').equals(stationId).toArray()
    const hereById = new Map(here.map((r) => [r.id, r]))

    const put = []
    for (const row of incoming) {
      if (waiting.has(`${table}:${row.id}`)) continue
      let next = keepColumns(row)
      const local = hereById.get(row.id)
      if (table === 'organizations') {
        // The station's owner here is whoever holds the owner's PIN on this computer.
        if (local?.owner_id && (await store.users.get(local.owner_id))) next = { ...next, owner_id: local.owner_id }
      }
      // Already here as it is on the web: nothing to write.
      if (local && Object.keys(next).every((k) => JSON.stringify(next[k]) === JSON.stringify(local[k]))) continue
      put.push(next)
    }
    const incomingIds = new Set(incoming.map((r) => r.id))
    const gone = table === 'organizations' ? [] : here.filter((r) => !incomingIds.has(r.id) && !waiting.has(`${table}:${r.id}`)).map((r) => r.id)

    await store.transaction('rw', store[table], async () => {
      if (put.length) await store[table].bulkPut(put)
      if (gone.length) await store[table].bulkDelete(gone)
    })
    counts[table] = incoming.length
    changed += put.length + gone.length
  }
  return { counts, changed }
}

/**
 * Moves this computer's records into the linked station: a computer set up before linking kept
 * them under a fixed local id (or another station it was linked to before). Says whether there
 * were any, so the first push can send them all.
 */
async function adoptStation(stationId) {
  const previous = [LOCAL_STATION_ID, getLink()?.stationId].filter((id) => id && id !== stationId)
  if (!previous.length) return false

  // The screens' copy is rebuilt from the local store after the pull; clear the old station's.
  for (const id of previous) await clearLocalData(id).catch(() => {})

  return moveStation(previous, stationId)
}

/**
 * Moves the records of the stations in `previous` to `stationId` in the local store, and says
 * whether any were station records the web keeps (so they need marking for a push). Also used
 * by a restore (lib/local/routes/local/backup/route.js) and the rescue at sign-in.
 */
export async function moveStation(previous, stationId) {
  let hadRecords = false
  for (const table of TABLES) {
    if (table === 'organizations') {
      for (const id of previous) {
        const row = await store.organizations.get(id)
        if (!row) continue
        await store.organizations.delete(id)
        if (!(await store.organizations.get(stationId))) await store.organizations.put({ ...row, id: stationId })
      }
      continue
    }
    if (!columnsOf(table).includes('org_id')) continue
    const rows = await store[table].where('org_id').anyOf(previous).toArray()
    if (!rows.length) continue
    if (SYNC_TABLES[table]) hadRecords = true
    await store[table].bulkPut(rows.map((r) => ({ ...r, org_id: stationId })))
  }
  // Their old entries in the outbox carried the old station; every row is marked again below.
  if (hadRecords) await store.outbox.clear()
  // The old station row itself is gone: its own entry would only ever be refused.
  else await store.outbox.bulkDelete(previous.map((id) => `organizations:${id}`))
  return hadRecords
}

/** Whether this computer holds any station records of its own, under any station id. */
async function hasOwnRecords() {
  for (const table of Object.keys(SYNC_TABLES)) {
    if (table === 'organizations') continue
    if (await store[table].count()) return true
  }
  return false
}

/**
 * Links this computer to a web station: the owner's web email and password, then a station when
 * they own several. Returns one of
 *
 *   { stations }                      choose one and call again with stationId
 *   { conflict, pending }             this computer and the web station both have records:
 *                                     finishLink(pending, { replaceLocal: true }) uses the web's
 *   { ok, station, owner, ... }       linked; with a subscription running, also pulled and this
 *                                     computer's own records pushed (else they wait for one)
 *   { canCreate }                     the account owns no station yet: offer createName
 *
 * With createName, a new web station is made for this computer's records and linked: they move
 * into it with its setup and opening balances, and go up with its first push once a
 * subscription is running.
 */
export async function link({ email, password, stationId, createName }) {
  const res = await linkComputer({ email, password, stationId, createName })
  if (!res.ok) return { ok: false, error: message(res, 'Could not link this computer'), canCreate: Boolean(res.body?.canCreate) }
  if (res.body.stations) return { ok: false, stations: res.body.stations }

  const pending = { station: res.body.station, owner: res.body.owner, licence: res.body.licence }
  // Linking the station it was already linked to (after a revoke) keeps everything here, and
  // what was waiting to be pushed still goes up: they are the same station's records.
  const again = getLink()?.stationId === pending.station.id
  if (!again && res.body.hasRecords && (await hasOwnRecords())) return { ok: false, conflict: true, pending }
  return finishLink(pending)
}

/**
 * Completes a link. With replaceLocal, this computer's own station records are cleared first
 * and the web station's are used (its staff and their PINs stay). Without it, this computer's
 * records move into the web station and are all pushed.
 */
export async function finishLink({ station, owner, licence }, { replaceLocal = false } = {}) {
  await processQueue()
  if (replaceLocal) {
    for (const table of Object.keys(SYNC_TABLES)) {
      if (table !== 'organizations') await store[table].clear()
    }
    await store.outbox.clear()
  }
  const hadRecords = await adoptStation(station.id)

  setLink({
    stationId: station.id,
    stationName: station.name,
    ownerId: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    linkedAt: new Date().toISOString(),
  })
  await saveLicence(licence)
  await checkLicence()
  if (hadRecords) await markEverythingChanged()

  // Without a subscription the link still holds: the records wait here for the first push.
  if (!paidNow()) return { ok: true, station, owner, hadRecords, pulled: null, pushed: null, unpaid: true }
  // Linking can move this computer's records to the station's id: rebuild the screens' copy.
  const pulled = await pull({ rebuild: true })
  const pushed = hadRecords ? await push() : null
  return { ok: true, station, owner, hadRecords, pulled, pushed }
}
