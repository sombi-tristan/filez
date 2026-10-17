import { store } from './store'
import { SYNC_TABLES } from '@/lib/desktopTables'

/**
 * What this computer has changed since it last pushed to the linked web station.
 *
 * Every write the in-app server makes (lib/local/supabase.js) to a synced table
 * (lib/desktopTables.js) lands here as one entry per row: `${table}:${id}` → the last thing that
 * happened to it, 'upsert' or 'delete'. A push (lib/local/webSync.js) sends each row as it now
 * stands and clears the entries the web accepted. A pull never writes here: it writes the store
 * directly, so rows that came from the web are not sent back.
 *
 * A computer holds several stations, each linked to its own web station or none: every entry
 * notes its station (`org`), and a push of one station sends only its own.
 */
const stationOf = (table, row) => (table === 'organizations' ? row?.id : row?.org_id)

export async function recordChanges(table, rows, op) {
  if (!SYNC_TABLES[table] || !rows?.length) return
  const at = Date.now()
  await store.outbox.bulkPut(rows.map((r) => ({ key: `${table}:${r.id}`, table, id: r.id, op, at, org: stationOf(table, r) })))
}

/**
 * The pending changes of a station (every station's without one), oldest first. An entry from a
 * computer from before notes no station: it goes with the station its row is in, or for a row
 * since deleted, with `legacyStationId`, the station that computer was linked to.
 */
export async function pendingChanges(stationId, { legacyStationId } = {}) {
  const all = await store.outbox.orderBy('at').toArray()
  if (!stationId) return all
  const mine = []
  for (const c of all) {
    const org = c.org || stationOf(c.table, await store[c.table]?.get(c.id)) || legacyStationId
    if (org === stationId) mine.push(c)
  }
  return mine
}

export async function pendingCount(stationId, options) {
  return stationId ? (await pendingChanges(stationId, options)).length : store.outbox.count()
}

/** Forget changes the web accepted, unless the row changed again while they were in flight. */
export async function clearChanges(sent) {
  await store.transaction('rw', store.outbox, async () => {
    for (const change of sent) {
      const now = await store.outbox.get(change.key)
      if (now && now.at === change.at) await store.outbox.delete(change.key)
    }
  })
}

/**
 * Every row of a station (of every station without one) counts as changed: for a first push of a
 * station's own records.
 */
export async function markEverythingChanged(stationId) {
  const at = Date.now()
  for (const table of Object.keys(SYNC_TABLES)) {
    const rows = (await store[table].toArray()).filter((r) => !stationId || stationOf(table, r) === stationId)
    if (rows.length) await store.outbox.bulkPut(rows.map((r) => ({ key: `${table}:${r.id}`, table, id: r.id, op: 'upsert', at, org: stationOf(table, r) })))
  }
}

// What a waiting change is, in words (the station page's list of changes to push).
const LABELS = {
  organizations: 'Station details',
  station_tanks: 'Tank',
  station_pumps: 'Pump',
  station_banks: 'Bank',
  station_lube_products: 'Lube product',
  station_customers: 'Customer',
  daily_sales_entries: 'Daily sales',
  product_receipt_entries: 'Product receipt',
  lodgement_entries: 'Lodgement',
  imprest_periods: 'Imprest period',
  imprest_entries: 'Imprest entry',
  lube_sales_entries: 'Lube sale',
  lube_stock_entries: 'Lube stock',
  customer_payment_entries: 'Account payment',
}

/**
 * Waiting changes as the station page lists them: { key, label, date, name, deleted }, newest
 * first. `date` is the entry's day, `name` a setup row's name, when the row is still here.
 */
export async function describeChanges(changes) {
  const out = []
  for (const c of changes) {
    const row = c.op === 'upsert' ? await store[c.table]?.get(c.id) : null
    out.push({
      key: c.key,
      label: LABELS[c.table] || c.table,
      date: row?.entry_date || row?.start_date || null,
      name: row?.name || row?.bank_name || row?.product_name || null,
      deleted: c.op === 'delete',
      at: c.at,
    })
  }
  return out.sort((a, b) => b.at - a.at)
}

/**
 * Throws away waiting changes: they will not be pushed. The rows here go back to the web's
 * version at the next pull (a row the web never had is removed then), as a pull does with any
 * row that is not waiting.
 */
export async function discardChanges(keys) {
  await store.outbox.bulkDelete(keys)
}
