import { store, TABLES, columnsOf } from './store'
import { pendingChanges, clearChanges, markEverythingChanged } from './outbox'
import { getLink, setLink, updateLink, allLinks, getCurrentStationId, setCurrentStationId } from './link'
import { saveLicence, checkLicence, paidNow } from './licence'
import { linkComputer, webGet, webPost } from './web'
import { getSessionUserId } from './session'
import { SYNC_TABLES, PUSH_ORDER, PUSH_BATCH } from '@/lib/desktopTables'
import { processQueue } from '@/lib/sync'
import { initialSync, clearLocalData } from '@/lib/initialSync'

/**
 * Push, pull and linking between this computer's stations and their web stations
 * (app/api/desktop/* on the web). A computer holds several stations, each linked to its own web
 * station or none; every call here is for one station, the one open now unless told which. The
 * computer works offline; these are the moments it reaches the web, and each one brings back a
 * fresh licence.
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
function failure(res, fallback, stationId) {
  if (res?.status === 401) {
    updateLink({ revoked: true }, stationId)
    return 'This computer was unlinked from its station on the web. Link it again to sync.'
  }
  return message(res, fallback)
}

/** The licence a response carries, kept as the station's if it verifies. */
async function keepLicence(res, stationId) {
  if (res?.body?.licence) await saveLicence(res.body.licence, stationId).catch(() => {})
}

// Changes from a computer from before note no station: they belong to the one it was linked to.
const legacy = () => ({ legacyStationId: allLinks()[0]?.stationId })

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
export async function refreshLicence(stationId = getCurrentStationId()) {
  const res = await webGet('/api/desktop/licence', stationId)
  if (!res.ok) return { ok: false, error: failure(res, 'Could not check the subscription', stationId) }
  await keepLicence(res, stationId)
  return { ok: true }
}

/**
 * Sends every change this computer has made since the last push, in batches, in table order so
 * a row arrives after the rows it points at. Rows the web refuses stay waiting and are listed.
 */
export function push(stationId = getCurrentStationId()) {
  return inTurn(() => pushNow(stationId))
}

async function pushNow(stationId) {
  const link = getLink(stationId)
  if (!link) return { ok: false, error: 'This station is not linked to a web station' }
  if (!paidNow(stationId)) return { ok: false, unpaid: true, error: UNPAID }
  await processQueue()

  const rank = (t) => PUSH_ORDER.indexOf(t)
  const changes = (await pendingChanges(stationId, legacy())).sort((a, b) => rank(a.table) - rank(b.table) || a.at - b.at)
  let pushed = 0
  const refused = []

  for (let i = 0; i < changes.length; i += PUSH_BATCH) {
    const batch = changes.slice(i, i + PUSH_BATCH)
    const payload = await Promise.all(batch.map(async (c) => {
      const row = c.op === 'upsert' ? await store[c.table].get(c.id) : null
      return row ? { table: c.table, op: 'upsert', id: c.id, row } : { table: c.table, op: 'delete', id: c.id }
    }))
    const res = await webPost('/api/desktop/push', { changes: payload }, stationId)
    // A refused push still carries a fresh licence: a lapsed subscription is known at once.
    await keepLicence(res, stationId)
    if (!res.ok) return { ok: false, pushed, refused, error: failure(res, 'Push failed', stationId) }

    const results = res.body.results || []
    const accepted = batch.filter((c, k) => results[k]?.ok)
    batch.forEach((c, k) => { if (!results[k]?.ok) refused.push({ table: c.table, id: c.id, error: results[k]?.error || 'Refused' }) })
    await clearChanges(accepted)
    pushed += accepted.length
  }

  updateLink({ lastPushAt: new Date().toISOString() }, stationId)
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

async function pullNow({ rebuild = false, stationId = getCurrentStationId() } = {}) {
  const link = getLink(stationId)
  if (!link) return { ok: false, error: 'This station is not linked to a web station' }
  if (!paidNow(stationId)) return { ok: false, unpaid: true, error: UNPAID }
  // A correction here waits to replace the web copy: taking the web's rows first would bring the
  // old ones back beside it.
  if (link.replacePending) return replaceNow(stationId)
  await processQueue()

  const res = await webGet('/api/desktop/pull', stationId)
  await keepLicence(res, stationId)
  if (!res.ok) return { ok: false, error: failure(res, 'Pull failed', stationId) }

  const { counts, changed } = await applyPulledRows(link.stationId, res.body.rows || {})
  // The screens' copy is read through the in-app server, which answers signed-in people only.
  // On first run nobody is yet: the screens build it themselves once someone signs in. A pull
  // that changed nothing here leaves it as it is.
  if ((changed || rebuild) && getSessionUserId()) await initialSync(link.stationId, { force: true })
  updateLink({ lastPullAt: new Date().toISOString(), stationName: res.body.station?.name || link.stationName }, stationId)
  return { ok: true, counts, changed }
}

/**
 * Notes that the station here is to replace its web copy (after a restore, or when asked): until
 * that has happened a pull does it instead of taking the web's rows.
 */
export function markReplaceWeb(stationId = getCurrentStationId()) {
  updateLink({ replacePending: true }, stationId)
}

/**
 * "Make the web match this computer": the station here is the source of truth when it corrects
 * something. The web station's copy is cleared (app/api/desktop/wipe on the web) and every row
 * of the station here is pushed. Anything entered on the web since the last pull is gone. Done
 * again in full until it has gone through, so a dropped connection only delays it.
 */
export function replaceWeb(stationId = getCurrentStationId()) {
  return inTurn(() => replaceNow(stationId))
}

async function replaceNow(stationId) {
  const link = getLink(stationId)
  if (!link) return { ok: false, error: 'This station is not linked to a web station' }
  if (!paidNow(stationId)) return { ok: false, unpaid: true, error: UNPAID }
  markReplaceWeb(stationId)
  await processQueue()

  const res = await webPost('/api/desktop/wipe', {}, stationId)
  await keepLicence(res, stationId)
  if (!res.ok) return { ok: false, error: failure(res, 'Could not replace the web copy', stationId) }

  // The web copy is now empty: whatever waited to go up (a deletion of a row gone everywhere,
  // say) is replaced by every row as it stands here.
  const stale = await pendingChanges(stationId, legacy())
  await store.outbox.bulkDelete(stale.map((c) => c.key))
  await markEverythingChanged(stationId)
  const pushed = await pushNow(stationId)
  if (pushed.ok && !pushed.refused.length) updateLink({ replacePending: false }, stationId)
  return { ...pushed, replaced: pushed.ok }
}

async function applyPulledRows(stationId, rows) {
  const waiting = new Set((await pendingChanges(stationId, legacy())).map((c) => c.key))
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
        // The station's owner here is the web account that owns it on this computer.
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
 * Moves the records of the stations in `previous` to `stationId` in the local store, and says
 * whether any were station records the web keeps (so they need marking for a push). Pending
 * changes of the old stations are dropped: their rows are marked again under the new one. Used
 * when a station on this computer is linked to its web station, and by a restore.
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
  for (const id of previous) {
    const stale = await pendingChanges(id, legacy())
    await store.outbox.bulkDelete(stale.map((c) => c.key))
  }
  return hadRecords
}

/** Whether a station on this computer holds records of its own. */
async function hasOwnRecords(stationId) {
  for (const table of Object.keys(SYNC_TABLES)) {
    if (table === 'organizations') continue
    if (await store[table].where('org_id').equals(stationId).count()) return true
  }
  return false
}

/**
 * Links a station on this computer (`localStationId`), or brings a new one down, to a web
 * station: the owner's web email and password, then a station when they own several. Returns
 * one of
 *
 *   { stations }                      choose one and call again with stationId
 *   { conflict, pending }             the station here and the web station both have records:
 *                                     finishLink(pending, { replaceLocal: true }) uses the web's
 *   { ok, station, owner, ... }       linked; with a subscription running, also pulled and the
 *                                     station's own records pushed (else they wait for one)
 *   { canCreate }                     the account owns no station yet: offer createName
 *   { ok: false, error }              e.g. that web station is already on this computer
 *
 *   localStationId  the station here to link; none to bring the web station down as a new one
 *   ownerHereId     who owns it here: the person signed in (a station brought down needs one)
 *
 * With createName, a new web station is made for the station's records and linked: they move
 * into it with its setup and opening balances, and go up with its first push once a
 * subscription is running.
 */
export async function link({ email, password, stationId, createName, localStationId = null, ownerHereId = null }) {
  const res = await linkComputer({ email, password, stationId, createName })
  if (!res.ok) return { ok: false, error: message(res, 'Could not link this computer'), canCreate: Boolean(res.body?.canCreate) }
  if (res.body.stations) return { ok: false, stations: res.body.stations }

  const pending = { station: res.body.station, owner: res.body.owner, licence: res.body.licence, localStationId, ownerHereId }
  const webId = pending.station.id
  // Linking the station it was already linked to (after a revoke) keeps everything here, and
  // what was waiting to be pushed still goes up: they are the same station's records.
  const again = localStationId === webId
  if (!again && (await store.organizations.get(webId))) {
    return { ok: false, error: `${pending.station.name} is already on this computer. Open it from your stations.` }
  }
  if (!again && localStationId && res.body.hasRecords && (await hasOwnRecords(localStationId))) return { ok: false, conflict: true, pending }
  return finishLink(pending)
}

/**
 * Completes a link. With replaceLocal, the station's own records here are cleared first and the
 * web station's are used (its staff and their PINs stay). Without it, its records move into the
 * web station and are all pushed. A station brought down (no localStationId) is new here.
 */
export async function finishLink({ station, owner, licence, localStationId = null, ownerHereId = null }, { replaceLocal = false } = {}) {
  await processQueue()
  const from = localStationId && localStationId !== station.id ? localStationId : null
  if (replaceLocal && localStationId) {
    for (const table of Object.keys(SYNC_TABLES)) {
      if (table !== 'organizations' && columnsOf(table).includes('org_id')) await store[table].where('org_id').equals(localStationId).delete()
    }
    const stale = await pendingChanges(localStationId, legacy())
    await store.outbox.bulkDelete(stale.map((c) => c.key))
  }
  let hadRecords = false
  if (from) {
    // The screens' copy is rebuilt from the local store after the pull; clear the old station's.
    await clearLocalData(from).catch(() => {})
    hadRecords = await moveStation([from], station.id)
  }
  // Who owns it here: kept for a station that was here, the person bringing it down for a new one.
  const here = await store.organizations.get(station.id)
  const ownerId = here?.owner_id || ownerHereId
  await store.organizations.put({
    ...(here || { id: station.id, slug: 'station', created_at: new Date().toISOString() }),
    name: here?.name || station.name,
    ...(ownerId ? { owner_id: ownerId } : {}),
  })

  setLink({
    stationId: station.id,
    stationName: station.name,
    ownerId: owner.id,
    ownerName: owner.name,
    ownerEmail: owner.email,
    linkedAt: new Date().toISOString(),
  })
  if (!localStationId || getCurrentStationId() === localStationId) setCurrentStationId(station.id)
  await saveLicence(licence, station.id)
  await checkLicence(Date.now(), station.id)
  if (hadRecords) await markEverythingChanged(station.id)

  // Without a subscription the link still holds: the records wait here for the first push.
  if (!paidNow(station.id)) return { ok: true, station, owner, hadRecords, pulled: null, pushed: null, unpaid: true }
  // Linking can move this station's records to the web station's id: rebuild the screens' copy.
  const pulled = await pull({ rebuild: true, stationId: station.id })
  const pushed = hadRecords ? await push(station.id) : null
  return { ok: true, station, owner, hadRecords, pulled, pushed }
}
